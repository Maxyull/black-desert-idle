// ═══ SAUVEGARDE AUTOMATIQUE (localStorage) ═══════════════════════
// Sauvegarde 100% locale (2026-07-19, demande explicite) : pas de compte Supabase pour ce
// module en v1 -- clé dédiée pour ne jamais collisionner avec les clés du jeu principal
// (même origine, localStorage partagé entre l'iframe et la page hôte).
/** Sérialise tout l'état du module (roster, silver, inventaire, compteurs, flags de migration) dans localStorage (clé dédiée, 100% locale). */
function saveGame(){
  try{
    const state = {
      PETS, SILVER, silverSpent, INVENTORY, incubSlots, eggTimer,
      petId, selFoodName, hatchCountSincePity,
      fusionCount, caphrasUpgradeCount, bossItemFound, breakthroughCount, totalHatched, fusionLostHighRarityCount,
      eggTypesUsed: Array.from(eggTypesUsed),
      completedAchievements: Array.from(completedAchievements),
      pityEverTriggered, loginStreak, lastLoginDate, petsRosterResetV1, petsRosterCapV1, petsUidV1,
      petsSpeciesRarityV1, autoFeedEnabled,
      savedAt: Date.now()
    };
    localStorage.setItem('velia_idle_pets_save', JSON.stringify(state));
  }catch(e){ console.warn('Sauvegarde impossible:', e); }
}

// ═══ RATTRAPAGE HORS-LIGNE ═══
// Simule (de façon simplifiée, pas tick-par-tick) ce que les pets sur le terrain
// auraient rapporté pendant l'absence. Plafonné à 24h pour éviter les excès.
const OFFLINE_CAP_HOURS = 24;
const OFFLINE_SILVER_PER_HOUR = 60;   // moyenne estimée par pet actif
const OFFLINE_COMMON_ITEMS_PER_HOUR = 3;

/**
 * @param {?number} savedAt - timestamp de la dernière sauvegarde. Simule (taux plat, pas
 * tick-par-tick) TOUT ce qui aurait avancé pendant l'absence, plafonné à OFFLINE_CAP_HOURS, ignoré
 * sous 3 minutes.
 *
 * Audit explicite (2026-07-13, "vérifier le mode hors ligne pour TOUS les types d'item") de tous
 * les timers/compteurs de ticks.js -- avant ce correctif, SEULS le silver et le loot commun des
 * pets déployés étaient rattrapés ; tout le reste retombait silencieusement à "rien ne s'est
 * passé" pendant l'absence :
 *   - timers de slots d'incubation (sl.tl) -- un joueur revenant après plusieurs heures trouvait
 *     ses œufs toujours "en cours" alors qu'ils auraient dû être prêts depuis longtemps.
 *   - compteur eggTimer (affichage #h-egg) -- même défaut, purement cosmétique mais incohérent.
 *   - XP de Tier des pets déployés (tierXp/tier) -- un pet resté des heures sur le terrain ne
 *     montait jamais de Tier pendant l'absence, contrairement au jeu principal.
 *   - loot spécial (Caphras/Pierres de Dopi) -- seul le loot COMMUN était rattrapé, les ressources
 *     spéciales (feed.js les exclut déjà de l'auto-nourrissage) ne l'étaient jamais.
 *   - auto-nourrissage (autoFeedEnabled) -- la faim redescendait pendant l'absence même si
 *     l'auto-nourrissage était actif, alors qu'en jeu réel il aurait consommé de la nourriture
 *     pour la maintenir. Item de boss (BOSS_ITEM_RATE, flat 1e-8/tick) volontairement PAS
 *     rattrapé : l'espérance sur 24h reste <0.05%, le simuler casserait le caractère "rarissime"
 *     voulu (même esprit que le pity, mais ici on ne veut PAS forcer l'issue).
 */
function applyOfflineProgress(savedAt){
  if(!savedAt) return;
  const elapsedMs = Date.now()-savedAt;
  const hours = Math.min(elapsedMs/3600000, OFFLINE_CAP_HOURS);
  if(hours<0.05) return; // moins de 3 minutes d'absence, pas la peine
  const seconds = hours*3600;

  // ═══ Slots d'incubation + compteur d'œuf gratuit ═══ (indépendant des pets déployés)
  incubSlots.forEach(sl=>{
    if(sl.locked||sl.ready||sl.tl<=0) return;
    sl.tl = Math.max(0, sl.tl-seconds);
    if(sl.tl<=0) sl.ready=true;
  });
  if(typeof eggTimer==='number'){
    let remaining = seconds;
    while(remaining>0){
      if(eggTimer>remaining){ eggTimer-=remaining; remaining=0; }
      else { remaining-=eggTimer; eggTimer=21600; } // même reset que ticks.js
    }
  }

  const activePets = PETS.filter(p=>p.terrain);
  if(!activePets.length){ saveGame(); return; }

  let totalSilver=0;
  const itemsGained={};
  const tierUps=[]; // {name, from, to} -- pour le résumé, jamais de toast individuel (pas de spam au retour)
  activePets.forEach(p=>{
    const sec=secById(p.cat.sec); if(!sec||!sec.drops) return;
    // rendement ×FARM_YIELD_MULT, identique au tick live (ticks.js) pour ne jamais désynchroniser
    // le hors-ligne et le temps réel (2026-07-18, "les compagnons farment au moins 5x plus").
    totalSilver += Math.round(OFFLINE_SILVER_PER_HOUR*hours) * FARM_YIELD_MULT;
    const commonDrop = sec.drops[0];
    const qty = Math.round(OFFLINE_COMMON_ITEMS_PER_HOUR*hours) * FARM_YIELD_MULT;
    if(qty>0){
      addToInventory(commonDrop.n, commonDrop.e, qty, commonDrop.feed);
      itemsGained[commonDrop.n] = (itemsGained[commonDrop.n]||0)+qty;
    }

    // Loot spécial (Caphras/Dopi) -- espérance arrondie (même esprit "taux plat" que le loot
    // commun ci-dessus, pas un tirage tick-par-tick) ; réutilise EXACTEMENT les taux de ticks.js
    // (CAPHRAS_BASE_RATE/DOPI_ITEMS.baseRate, cadence de 2s) pour ne jamais désynchroniser les 2
    // calculs.
    const specialTicks = seconds/2;
    const tf = zoneTierFactor(p);
    const caphrasQty = Math.round(CAPHRAS_BASE_RATE*tf*specialTicks) * FARM_YIELD_MULT;
    if(caphrasQty>0){
      addToInventory(CAPHRAS_ITEM.n, CAPHRAS_ITEM.e, caphrasQty, CAPHRAS_ITEM.feed);
      itemsGained[CAPHRAS_ITEM.n] = (itemsGained[CAPHRAS_ITEM.n]||0)+caphrasQty;
    }
    DOPI_ITEMS.forEach(dopi=>{
      const qtyD = Math.round(dopi.baseRate*tf*specialTicks) * FARM_YIELD_MULT;
      if(qtyD>0){
        addToInventory(dopi.n, dopi.e, qtyD, dopi.feed);
        itemsGained[dopi.n] = (itemsGained[dopi.n]||0)+qtyD;
      }
    });

    // Faim -- l'auto-nourrissage (feed.js) aurait maintenu la faim au-dessus du seuil critique si
    // de la nourriture était disponible ; sans simuler la consommation exacte (pas d'inventaire
    // "au fil du temps" fiable hors-ligne), on simule plutôt un plancher (l'auto-nourrissage
    // intervient avant que la faim tombe trop bas) plutôt qu'une simple baisse ralentie -- sinon
    // une absence assez longue ramènerait quand même la faim à 0 même avec l'auto-nourrissage
    // actif, ce qui bloquerait à tort le rattrapage d'XP de Tier ci-dessous (qui exige faim>10).
    const hungerFloor = autoFeedEnabled ? 50 : 0;
    const hungerDecay = autoFeedEnabled ? hours*10 : hours*36;
    p.hunger = Math.max(hungerFloor, p.hunger - hungerDecay); // taux volontairement plus doux que le tick live pour ne pas punir une absence

    // XP de Tier -- même condition que ticks.js (déployé, faim>10, pas déjà Tier 5), même
    // cadence (2 XP/s) ; simplifié SANS breakthrough de rareté (RARITY_BREAKTHROUGH_CHANCE
    // reste un tirage aléatoire par montée -- le simuler hors-ligne romprait le pity/l'équilibrage
    // de la même façon que l'item de boss ci-dessus, jamais souhaitable pour un événement rare).
    if(p.hunger>10 && (p.tier||1)<5){
      let xpGain = 2*seconds;
      let tier = p.tier||1, tierXp = p.tierXp||0;
      const fromTier = tier;
      while(xpGain>0 && tier<5){
        const xpMax = TIER_XP_NEEDED[tier]-TIER_XP_NEEDED[tier-1];
        const need = xpMax-tierXp;
        if(xpGain<need){ tierXp+=xpGain; xpGain=0; }
        else { xpGain-=need; tier++; tierXp=0; p.tierMult=rollTierMult(tier); }
      }
      if(tier!==fromTier) tierUps.push({name:p.cat.name, from:fromTier, to:tier});
      p.tier=tier; p.tierXp=tierXp;
    }
  });

  if(totalSilver>0 || tierUps.length){
    earnSilver(totalSilver, 'compagnon:hors-ligne');
    const itemsText = Object.entries(itemsGained).map(([n,q])=>`${q}× ${itemLabel(n)}`).join(', ');
    const hLabel = hours>=1 ? `${hours.toFixed(1)}h` : `${Math.round(hours*60)}min`;
    const tierText = tierUps.length ? ` — ${tierUps.map(t=>`${t.name} T${t.from}➡️T${t.to}`).join(', ')}` : '';
    toast('🎁', i18next.t('companions:companions.save.offline_toast', {duration:hLabel, silver:totalSilver.toLocaleString(NUM_LOCALE), items:itemsText, tiers:tierText}));
    addGameLog(i18next.t('companions:companions.save.offline_log_html', {duration:hLabel, silver:totalSilver.toLocaleString(NUM_LOCALE), items:itemsText, tiers:tierText}));
  }
  saveGame(); // persiste immédiatement le rattrapage (silver/items/hunger/tier/slots), avant l'autosave 5s
  if(document.getElementById('p0')?.classList.contains('active')) renderHatch();
  if(document.getElementById('p5')?.classList.contains('active')){ renderGameInventory(); renderGameLog(); updateSilverDisplay(); }
  if(document.getElementById('p1')?.classList.contains('active')){ renderSecNav(); renderSecDetail(); }
  if(document.getElementById('p2')?.classList.contains('active')) renderGrid();
}

// bug corrigé (2026-07-11, rapporté explicitement : "Fenetre hors ligne non affichée au retour
// d'un jour") -- applyOfflineProgress() n'était appelée QU'à loadGame() (chargement de l'iframe).
// Si le joueur laisse l'onglet ouvert (ordinateur en veille, ou juste l'onglet en arrière-plan
// longtemps) sans jamais recharger la page, l'iframe reste chargée en mémoire et loadGame() ne
// re-tourne jamais -- le rattrapage hors-ligne n'avait donc AUCUN moyen de se déclencher après une
// vraie absence d'une journée sans fermeture du navigateur. Même pattern que le jeu principal
// (showAwayLootSummaryIfAny() sur visibilitychange, core/game-core.js) : marque le moment où
// l'onglet passe caché, applique le rattrapage au retour visible. applyOfflineProgress() a déjà
// son propre garde-fou (hours<0.05 ~3min) qui absorbe les changements d'onglet courts sans rien
// déclencher. Pas de double-comptage avec le tick temps réel (ticks.js) : depuis le 2026-07-18, ce
// tick fait `if(document.hidden) return;` en tête -- il n'avance donc RIEN pendant que l'onglet est
// caché, et applyOfflineProgress rattrape seul (et une seule fois) toute la durée cachée. Avant ce
// garde, un onglet simplement en arrière-plan (pas en veille système) laissait le navigateur brider
// mais PAS arrêter le setInterval : le temps caché était compté deux fois.
let lastVisibleTs = Date.now();
document.addEventListener('visibilitychange', () => {
  if(document.hidden){
    lastVisibleTs = Date.now();
  } else {
    applyOfflineProgress(lastVisibleTs);
    lastVisibleTs = Date.now();
  }
});

// migration rétroactive (2026-07-20, demande explicite : "supprime tout compagnon au dessus de la
// limite") -- purge l'excédent au-delà de PET_ROSTER_CAP (96, roster.js). Garde TOUJOURS
// les pets actuellement déployés sur le terrain (quel que soit leur GS -- jamais casser une
// configuration active), puis complète avec les meilleurs GS parmi le reste jusqu'au plafond.
/** Migration rétroactive : purge l'excédent au-delà de PET_ROSTER_CAP, garde toujours les pets déployés puis complète avec les meilleurs GS parmi le reste. */
function trimRosterToCapIfNeeded(){
  if(PETS.length <= PET_ROSTER_CAP) return;
  const deployed = PETS.filter(p=>p.terrain);
  const others = PETS.filter(p=>!p.terrain).sort((a,b)=>normGS(b)-normGS(a));
  const keepOthersCount = Math.max(0, PET_ROSTER_CAP - deployed.length);
  const removedCount = PETS.length - (deployed.length + Math.min(keepOthersCount, others.length));
  PETS = [...deployed, ...others.slice(0, keepOthersCount)];
  if(removedCount>0 && typeof toast==='function'){
    toast('📦', i18next.t('companions:companions.save.trim_toast', {count:removedCount, cap:PET_ROSTER_CAP}));
  }
}
// migration rétroactive (2026-07-10, marché d'échange) -- tout pet créé avant l'ajout de `uid`
// (rollAndCreatePet, hatch.js) n'en a pas : indispensable avant de pouvoir le mettre en
// vente (pet_uid est la clé serveur). Gatée par petsUidV1 (pas de flag par pet -- un seul passage
// suffit, générer un uid à un pet qui en a déjà un ne se produit jamais après ce passage).
/** Migration rétroactive : génère un uid pour tout pet créé avant l'ajout du marché d'échange (pet_uid = clé serveur). */
function migratePetUidV1(){
  PETS.forEach(p=>{ if(!p.uid) p.uid = crypto.randomUUID(); });
}
// migration rétroactive (2026-07-21, demande explicite : "lorsqu'on passe a la rareté superieur,
// on change de nom et on prend les noms de la rareté superieur") -- réaligne p.cat sur la bonne
// espèce (même section, rareté = p.rar réel) pour tout pet dont la percée d'AVANT ce correctif
// (ticks.js) a laissé un nom d'espèce périmé. Ne touche PAS les pets fraîchement éclos dont le
// léger décalage ±1 entre p.rar et p.cat.rar est voulu (rollAndCreatePet, hatch.js) -- seul un
// écart de 2 ou plus prouve une (ou plusieurs) percée(s) historique(s), jamais un simple hatch.
/** Migration rétroactive : réaligne p.cat sur l'espèce correspondant à p.rar quand l'écart prouve une percée historique antérieure au correctif (écart ≥2, jamais le ±1 normal d'un hatch récent). */
function migratePetSpeciesRarityV1(){
  PETS.forEach(p=>{
    if(Math.abs(p.rar - p.cat.rar) < 2) return;
    const newCat = speciesForSectionAndRarity(p.cat.sec, p.rar);
    if(newCat) p.cat = newCat;
  });
}
/** @returns {boolean} charge l'état sauvegardé (localStorage), applique les migrations rétroactives une seule fois chacune (flags petsRosterResetV1/petsRosterCapV1/petsUidV1/petsSpeciesRarityV1), rattrape le hors-ligne. false si aucune sauvegarde ou erreur (nouveau joueur). */
function loadGame(){
  try{
    const raw = localStorage.getItem('velia_idle_pets_save');
    // nouveau joueur (aucune sauvegarde) : PETS=[] déjà par défaut (roster.js), rien à
    // migrer -- marque directement le flag pour ne jamais redéclencher la migration plus tard.
    if(!raw){ petsRosterResetV1 = true; return false; }
    const state = JSON.parse(raw);
    // migration rétroactive (2026-07-19, demande explicite : "supprime les 48 pet pour tout le
    // monde") -- voir petsRosterResetV1 (economy.js). Vide le roster UNE SEULE FOIS
    // pour toute sauvegarde antérieure à ce changement, jamais plus ensuite.
    const needsRosterReset = !state.petsRosterResetV1;
    PETS = needsRosterReset ? [] : (state.PETS || PETS);
    SILVER = state.SILVER ?? SILVER;
    // pool partagé (2026-07-18) : si l'hôte est présent, le silver du JEU fait autorité -- le miroir
    // local sauvegardé est écrasé par le solde réel du jeu. Repli sur la valeur locale sinon.
    syncSilverFromHost();
    silverSpent = state.silverSpent || 0;
    INVENTORY = state.INVENTORY || {};
    incubSlots = state.incubSlots || incubSlots;
    // plafond 8 slots (2026-07-10, demande explicite : "borner incubation a 8") -- une sauvegarde
    // antérieure au plafond pouvait déjà en avoir davantage ; on tronque au chargement plutôt que
    // d'ajouter un flag de migration dédié (simple plafond UI, aucune perte de pet/objet possédé).
    if(typeof MAX_INCUB_SLOTS === 'number' && incubSlots.length > MAX_INCUB_SLOTS) incubSlots.length = MAX_INCUB_SLOTS;
    eggTimer = state.eggTimer ?? eggTimer;
    petId = state.petId || petId;
    selFoodName = state.selFoodName || null;
    hatchCountSincePity = state.hatchCountSincePity || 0;
    fusionCount = state.fusionCount || 0;
    caphrasUpgradeCount = state.caphrasUpgradeCount || 0;
    bossItemFound = state.bossItemFound || false;
    breakthroughCount = state.breakthroughCount || 0;
    totalHatched = state.totalHatched || 0;
    fusionLostHighRarityCount = state.fusionLostHighRarityCount || 0;
    eggTypesUsed = new Set(state.eggTypesUsed || []);
    completedAchievements = new Set(state.completedAchievements || []);
    pityEverTriggered = state.pityEverTriggered || false;
    loginStreak = state.loginStreak || 0;
    lastLoginDate = state.lastLoginDate || null;
    autoFeedEnabled = state.autoFeedEnabled !== undefined ? state.autoFeedEnabled : true;
    syncAutoFeedToggleDom();
    petsRosterResetV1 = true; // posé qu'une migration ait eu lieu ou non -- ne redéclenche jamais
    // migration rétroactive (2026-07-20, "supprime tout compagnon au dessus de la limite") --
    // purge l'excédent au-delà de PET_ROSTER_CAP (96) une seule fois, voir trimRosterToCapIfNeeded()
    const needsRosterCap = !state.petsRosterCapV1;
    if(needsRosterCap) trimRosterToCapIfNeeded();
    petsRosterCapV1 = true;
    const needsPetUid = !state.petsUidV1;
    if(needsPetUid) migratePetUidV1();
    petsUidV1 = true;
    // migration rétroactive (2026-07-21, "on change de nom et on prend les noms de la rareté
    // superieur") -- voir migratePetSpeciesRarityV1() ci-dessus.
    const needsSpeciesRarity = !state.petsSpeciesRarityV1;
    if(needsSpeciesRarity) migratePetSpeciesRarityV1();
    petsSpeciesRarityV1 = true;
    if(needsRosterReset || needsRosterCap || needsPetUid || needsSpeciesRarity) saveGame(); // persiste immédiatement (roster modifié + flag), avant l'autosave 5s
    applyOfflineProgress(state.savedAt);
    checkDailyStreak();
    return true;
  }catch(e){ console.warn('Chargement impossible:', e); return false; }
}
setInterval(saveGame, 5000); // autosave toutes les 5s

// ═══ RESET DE SAUVEGARDE ═══
// Export/Import JSON retirés (2026-07-20, demande explicite : "enlever import export") -- ne
// restait qu'un filet de sécurité local, jamais relié à la sauvegarde cloud (module 100%
// localStorage, voir CLAUDE.md §28), et source de confusion pour les joueurs vu qu'aucune autre
// partie du jeu principal n'expose ce genre de bouton.
/** Efface la sauvegarde locale (avec confirmation) et recharge la page (roster de départ, 0 pet). */
function resetSave(){
  if(!confirm(i18next.t('companions:companions.save.reset_confirm'))) return;
  localStorage.removeItem('velia_idle_pets_save');
  location.reload();
}
