// ═══ SAUVEGARDE AUTOMATIQUE (localStorage) ═══════════════════════
// Sauvegarde 100% locale (2026-07-19, demande explicite) : pas de compte Supabase pour ce
// module en v1 -- clé dédiée pour ne jamais collisionner avec les clés du jeu principal
// (même origine, localStorage partagé entre l'iframe et la page hôte).
function saveGame(){
  try{
    const state = {
      PETS, SILVER, INVENTORY, incubSlots, eggTimer,
      petId, selFoodName, hatchCountSincePity,
      fusionCount, caphrasUpgradeCount, bossItemFound, breakthroughCount, totalHatched,
      eggTypesUsed: Array.from(eggTypesUsed),
      completedAchievements: Array.from(completedAchievements),
      pityEverTriggered, loginStreak, lastLoginDate,
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
}

function loadGame(){
  try{
    const raw = localStorage.getItem('velia_idle_pets_save');
    if(!raw) return false;
    const state = JSON.parse(raw);
    PETS = state.PETS || PETS;
    SILVER = state.SILVER ?? SILVER;
    INVENTORY = state.INVENTORY || {};
    incubSlots = state.incubSlots || incubSlots;
    eggTimer = state.eggTimer ?? eggTimer;
    petId = state.petId || petId;
    selFoodName = state.selFoodName || null;
    hatchCountSincePity = state.hatchCountSincePity || 0;
    fusionCount = state.fusionCount || 0;
    caphrasUpgradeCount = state.caphrasUpgradeCount || 0;
    bossItemFound = state.bossItemFound || false;
    breakthroughCount = state.breakthroughCount || 0;
    totalHatched = state.totalHatched || 0;
    eggTypesUsed = new Set(state.eggTypesUsed || []);
    completedAchievements = new Set(state.completedAchievements || []);
    pityEverTriggered = state.pityEverTriggered || false;
    loginStreak = state.loginStreak || 0;
    lastLoginDate = state.lastLoginDate || null;
    applyOfflineProgress(state.savedAt);
    checkDailyStreak();
    return true;
  }catch(e){ console.warn('Chargement impossible:', e); return false; }
}
setInterval(saveGame, 5000); // autosave toutes les 5s

// ═══ EXPORT / IMPORT DE SAUVEGARDE (filet de sécurité) ═══
function resetSave(){
  if(!confirm('Effacer la sauvegarde et recharger le roster de départ (40 pets) ?\n\nTa progression actuelle sera définitivement perdue. Exporte-la avant si tu veux la garder.')) return;
  localStorage.removeItem('velia_idle_pets_save');
  location.reload();
}

function exportSave(){
  const state = {
    PETS, SILVER, INVENTORY, incubSlots, eggTimer, petId, selFoodName, hatchCountSincePity,
    fusionCount, caphrasUpgradeCount, bossItemFound, breakthroughCount,
    eggTypesUsed: Array.from(eggTypesUsed),
    completedAchievements: Array.from(completedAchievements),
    pityEverTriggered, loginStreak, lastLoginDate,
    savedAt: Date.now()
  };
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `velia-idle-save-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('💾','Sauvegarde exportée !');
}

function importSave(input){
  const file = input.files?.[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    try{
      const state = JSON.parse(e.target.result);
      PETS = state.PETS || PETS;
      SILVER = state.SILVER ?? SILVER;
      INVENTORY = state.INVENTORY || {};
      incubSlots = state.incubSlots || incubSlots;
      eggTimer = state.eggTimer ?? eggTimer;
      petId = state.petId || petId;
      selFoodName = state.selFoodName || null;
      hatchCountSincePity = state.hatchCountSincePity || 0;
      fusionCount = state.fusionCount || 0;
      caphrasUpgradeCount = state.caphrasUpgradeCount || 0;
      bossItemFound = state.bossItemFound || false;
      breakthroughCount = state.breakthroughCount || 0;
      eggTypesUsed = new Set(state.eggTypesUsed || []);
      completedAchievements = new Set(state.completedAchievements || []);
      pityEverTriggered = state.pityEverTriggered || false;
      loginStreak = state.loginStreak || 0;
      lastLoginDate = state.lastLoginDate || null;
      saveGame();
      renderAll();
      toast('📥','Sauvegarde importée avec succès !');
    }catch(err){
      toast('❌','Fichier de sauvegarde invalide');
    }
  };
  reader.readAsText(file);
  input.value=''; // reset pour pouvoir réimporter le même fichier si besoin
}
