// ═══ TYPES D'ŒUFS — coût qui explose pour un gain d'odds marginal ═══
// Cadence de référence : 1 œuf gratuit / 6h = 4/jour.
// Odds calibrées pour offrir ~62-70% de chance d'obtenir au moins 1 pet de cette
// rareté sur la période cible, via la formule 1-(1-p)^n :
//   Rare       → 1 par semaine   (n=28  tirages) → p≈3.57%
//   Épique     → 1 par 2 semaines(n=56  tirages) → p≈1.79%
//   Légendaire → 1 par 3 semaines(n=84  tirages) → p≈1.19%
//   Ancestral  → 1 par mois      (n=120 tirages) → p≈0.83%
const EGG_TYPES=[
  {id:'basic',   name:'Œuf Basique', ico:'🥚', cost:0,     costLabel:'Gratuit', odds:[55.57,37.05,3.57,1.79,1.19,0.83]},
  {id:'silver',  name:'Œuf Argenté', ico:'🥈', cost:800,   costLabel:'800 Silver',   odds:[54.78,36.52,3.96,2.04,1.45,1.25]},
  {id:'gold',    name:'Œuf Doré',    ico:'🥇', cost:8000,  costLabel:'8 000 Silver', odds:[53.49,35.66,4.43,2.56,1.89,1.97]},
  {id:'platinum',name:'Œuf Platine', ico:'💠', cost:40000, costLabel:'40 000 Silver',odds:[51.80,34.54,4.68,3.33,2.74,2.91]},
];

// ═══ ŒUFS CIBLÉS PAR RARETÉ ═══════════════════════════════════════
// Idée : booster franchement la ligne d'UNE rareté choisie. Comme le total doit
// toujours faire 100%, toutes les AUTRES lignes descendent mécaniquement et
// proportionnellement entre elles (redistribution, pas juste un ajout).
// makeTargetedOdds(rar, targetPct) : la rareté visée devient targetPct%, le
// reste (100-targetPct) est réparti entre les 5 autres raretés en conservant
// leur PROPORTION relative d'origine (celle de l'Œuf Basique).
function makeTargetedOdds(targetRar, targetPct){
  const base = EGG_TYPES[0].odds; // proportions de référence = Œuf Basique
  const sumOthersBase = 100 - base[targetRar];
  const remaining = 100 - targetPct;
  return base.map((v,i)=>{
    if(i===targetRar) return targetPct;
    return +(v * (remaining/sumOthersBase)).toFixed(2);
  });
}

// Coût croissant avec la puissance de la rareté ciblée + le boost obtenu
const TARGETED_EGG_DEFS = [
  {rar:2, targetPct:14,  cost:6000,   costLabel:'6 000 Silver'},   // Rare
  {rar:3, targetPct:7,   cost:20000,  costLabel:'20 000 Silver'},  // Épique
  {rar:4, targetPct:3.5, cost:60000,  costLabel:'60 000 Silver'},  // Légendaire
  {rar:5, targetPct:2,   cost:150000, costLabel:'150 000 Silver'}, // Ancestral
];
TARGETED_EGG_DEFS.forEach(def=>{
  EGG_TYPES.push({
    id:'target_'+def.rar,
    name:`Œuf ${RARITIES[def.rar].name}`,
    ico:'🎯',
    cost:def.cost,
    costLabel:def.costLabel,
    odds:makeTargetedOdds(def.rar, def.targetPct),
    targeted:true,
    targetRar:def.rar,
  });
});

// Économie fermée (2026-07-19, demande explicite) : ce Silver/inventaire est propre
// au module Compagnons, totalement indépendant du Silver/inventaire du jeu principal.
let SILVER = 55000; // solde de départ pour tester les tiers d'œufs

// ═══ PITY COUNTER ═══ Garantit un Ancestral après trop d'éclosions sans en avoir eu
// (protection contre la malchance extrême — sans ça, en pur RNG, un joueur pourrait
// théoriquement ne jamais en voir un). 500 éclosions ≈ 4 mois à 1 œuf gratuit/6h.
const PITY_THRESHOLD = 500;
let hatchCountSincePity = 0;
let pityEverTriggered = false;

// ═══ TRACKING POUR ACHIEVEMENTS ═══
let fusionCount = 0;
let caphrasUpgradeCount = 0;
let bossItemFound = false;
let breakthroughCount = 0;
let eggTypesUsed = new Set();
let completedAchievements = new Set();

// ═══ STREAK DE CONNEXION QUOTIDIENNE ═══
// Récompense croissante sur 7 jours consécutifs, reset si un jour est manqué.
let loginStreak = 0;
let lastLoginDate = null; // format 'YYYY-MM-DD'
const STREAK_REWARDS = [
  {silver:5,  bonus:null},
  {silver:8,  bonus:null},
  {silver:12, bonus:null},
  {silver:18, bonus:'Œuf Argenté gratuit'},
  {silver:25, bonus:null},
  {silver:35, bonus:null},
  {silver:60, bonus:'Œuf Doré gratuit'},
];

function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function daysBetween(d1,d2){
  return Math.round((new Date(d2)-new Date(d1))/86400000);
}

function checkDailyStreak(){
  const today = todayStr();
  if(lastLoginDate===today) return; // déjà connecté aujourd'hui, rien à faire

  if(lastLoginDate===null){
    loginStreak = 1;
  } else {
    const gap = daysBetween(lastLoginDate, today);
    if(gap===1) loginStreak = Math.min(7, loginStreak+1); // jour suivant consécutif
    else loginStreak = 1; // rupture de streak -> repart à 1
  }
  lastLoginDate = today;

  const idx = loginStreak-1;
  const reward = STREAK_REWARDS[idx];
  SILVER += reward.silver;
  updateSilverDisplay();

  let msg = `🔥 Streak Jour ${loginStreak}/7 — +${reward.silver} Silver`;
  if(reward.bonus){
    // Bonus spécial : œuf gratuit accordé directement dans la réserve d'incubation si un slot est libre
    const freeSlotIdx = incubSlots.findIndex(s=>!s.locked && !s.ready);
    if(freeSlotIdx>=0){ incubSlots[freeSlotIdx].tl=0; incubSlots[freeSlotIdx].ready=true; }
    msg += ` + ${reward.bonus} !`;
  }
  toast('🔥', msg);
  addGameLog(`🔥 <span style="color:var(--gold2)">Connexion Jour ${loginStreak}/7</span> — +${reward.silver} Silver${reward.bonus?' + '+reward.bonus:''}`);
}

// ═══ INVENTAIRE & JOURNAL — alimentés par les pets sur le terrain ═══
let INVENTORY = {}; // { "Minerai de fer": 12, ... }
let GAME_LOG = [];  // liste de {t, text}

function addToInventory(itemName, icon, qty, feed){
  if(!INVENTORY[itemName]) INVENTORY[itemName] = {icon, qty:0, feed:feed||0};
  INVENTORY[itemName].qty += qty;
  if(feed!==undefined) INVENTORY[itemName].feed = feed; // garde la valeur nutritive à jour
}
function addGameLog(text){
  const now=new Date();
  const t=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  GAME_LOG.unshift({t, text});
  if(GAME_LOG.length>40) GAME_LOG.pop();
}
