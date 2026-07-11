// ═══ SAUVEGARDE AUTOMATIQUE (localStorage) ═══════════════════════
// Sauvegarde 100% locale (2026-07-19, demande explicite) : pas de compte Supabase pour ce
// module en v1 -- clé dédiée pour ne jamais collisionner avec les clés du jeu principal
// (même origine, localStorage partagé entre l'iframe et la page hôte).
function saveGame(){
  try{
    const state = {
      PETS, SILVER, silverSpent, INVENTORY, incubSlots, eggTimer,
      petId, selFoodName, hatchCountSincePity,
      fusionCount, caphrasUpgradeCount, bossItemFound, breakthroughCount, totalHatched, fusionLostHighRarityCount,
      eggTypesUsed: Array.from(eggTypesUsed),
      completedAchievements: Array.from(completedAchievements),
      pityEverTriggered, loginStreak, lastLoginDate, petsRosterResetV1, petsRosterCapV1, petsUidV1,
      petsSpeciesRarityV1,
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

function applyOfflineProgress(savedAt){
  if(!savedAt) return;
  const elapsedMs = Date.now()-savedAt;
  const hours = Math.min(elapsedMs/3600000, OFFLINE_CAP_HOURS);
  if(hours<0.05) return; // moins de 3 minutes d'absence, pas la peine

  const activePets = PETS.filter(p=>p.terrain);
  if(!activePets.length) return;

  let totalSilver=0;
  const itemsGained={};
  activePets.forEach(p=>{
    const sec=secById(p.cat.sec); if(!sec||!sec.drops) return;
    totalSilver += Math.round(OFFLINE_SILVER_PER_HOUR*hours);
    const commonDrop = sec.drops[0];
    const qty = Math.round(OFFLINE_COMMON_ITEMS_PER_HOUR*hours);
    if(qty>0){
      addToInventory(commonDrop.n, commonDrop.e, qty, commonDrop.feed);
      itemsGained[commonDrop.n] = (itemsGained[commonDrop.n]||0)+qty;
    }
    p.hunger = Math.max(0, p.hunger - hours*36); // note: plafonné par le hunger min 0 ; taux volontairement plus doux que le tick live pour ne pas punir une absence
  });

  if(totalSilver>0){
    SILVER += totalSilver;
    const itemsText = Object.entries(itemsGained).map(([n,q])=>`${q}× ${n}`).join(', ');
    const hLabel = hours>=1 ? `${hours.toFixed(1)}h` : `${Math.round(hours*60)}min`;
    toast('🎁', `Retour après ${hLabel} — +${totalSilver.toLocaleString('fr-FR')} Silver, ${itemsText}`);
    addGameLog(`🎁 Rattrapage hors-ligne (${hLabel}) : +${totalSilver.toLocaleString('fr-FR')} Silver, ${itemsText}`);
  }
  saveGame(); // persiste immédiatement le rattrapage (silver/items/hunger), avant l'autosave 5s
  if(document.getElementById('p5')?.classList.contains('active')){ renderGameInventory(); renderGameLog(); updateSilverDisplay(); }
  if(document.getElementById('p1')?.classList.contains('active')) renderSecDetail();
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
// déclencher -- pas de risque de double-comptage avec le tick temps réel (ticks.js), qui de toute
// façon ne tourne plus une fois l'onglet vraiment suspendu (veille système).
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
function trimRosterToCapIfNeeded(){
  if(PETS.length <= PET_ROSTER_CAP) return;
  const deployed = PETS.filter(p=>p.terrain);
  const others = PETS.filter(p=>!p.terrain).sort((a,b)=>normGS(b)-normGS(a));
  const keepOthersCount = Math.max(0, PET_ROSTER_CAP - deployed.length);
  const removedCount = PETS.length - (deployed.length + Math.min(keepOthersCount, others.length));
  PETS = [...deployed, ...others.slice(0, keepOthersCount)];
  if(removedCount>0 && typeof toast==='function'){
    toast('📦', `${removedCount} familier${removedCount>1?'s':''} en trop supprimé${removedCount>1?'s':''} (plafond ${PET_ROSTER_CAP}) — les moins bien roulés retirés en premier`);
  }
}
// migration rétroactive (2026-07-10, marché d'échange) -- tout pet créé avant l'ajout de `uid`
// (rollAndCreatePet, hatch.js) n'en a pas : indispensable avant de pouvoir le mettre en
// vente (pet_uid est la clé serveur). Gatée par petsUidV1 (pas de flag par pet -- un seul passage
// suffit, générer un uid à un pet qui en a déjà un ne se produit jamais après ce passage).
function migratePetUidV1(){
  PETS.forEach(p=>{ if(!p.uid) p.uid = crypto.randomUUID(); });
}
// migration rétroactive (2026-07-21, demande explicite : "lorsqu'on passe a la rareté superieur,
// on change de nom et on prend les noms de la rareté superieur") -- réaligne p.cat sur la bonne
// espèce (même section, rareté = p.rar réel) pour tout pet dont la percée d'AVANT ce correctif
// (ticks.js) a laissé un nom d'espèce périmé. Ne touche PAS les pets fraîchement éclos dont le
// léger décalage ±1 entre p.rar et p.cat.rar est voulu (rollAndCreatePet, hatch.js) -- seul un
// écart de 2 ou plus prouve une (ou plusieurs) percée(s) historique(s), jamais un simple hatch.
function migratePetSpeciesRarityV1(){
  PETS.forEach(p=>{
    if(Math.abs(p.rar - p.cat.rar) < 2) return;
    const newCat = speciesForSectionAndRarity(p.cat.sec, p.rar);
    if(newCat) p.cat = newCat;
  });
}
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
function resetSave(){
  if(!confirm('Effacer la sauvegarde et recharger le roster de départ (0 pet) ?\n\nTa progression actuelle sera définitivement perdue.')) return;
  localStorage.removeItem('velia_idle_pets_save');
  location.reload();
}
