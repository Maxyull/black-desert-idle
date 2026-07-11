// Version affichée en bas à gauche du module (2026-07-20, demande explicite : "ajoute version en
// bas a gauche") -- réutilise la MÊME numérotation "VNNN" que le reste du jeu (meta/patch-notes-
// data.js), plutôt qu'un compteur séparé propre à ce module : ce dossier ne peut pas charger
// meta/patch-notes-data.js (scope global distinct, iframe isolée), donc pas de lecture automatique
// possible -- à bumper à la main ici à chaque patch note qui touche sub:'compagnon'.
const COMPANION_MODULE_VERSION = 'V363';

// ═══ BALANCE DE TEST (2026-07-10, demande explicite) ═══
// Tous les coûts Silver et timers (incubation, œuf gratuit) sont divisés par ce facteur pour
// tester rapidement les flux -- repasser TEST_BALANCE_DIVISOR à 1 pour revenir aux vraies
// valeurs (aucune autre ligne à toucher, tout est dérivé de cette seule constante).
const TEST_BALANCE_DIVISOR = 1000;
function scaleCost(v){ return v>0 ? Math.max(1, Math.round(v/TEST_BALANCE_DIVISOR)) : 0; }
function scaleTimer(v){ return Math.max(1, Math.round(v/TEST_BALANCE_DIVISOR)); }
function costLabelFor(v){ return v>0 ? `${v.toLocaleString('fr-FR')} Silver` : 'Gratuit'; }

// ═══ TYPES D'ŒUFS — coût qui explose pour un gain d'odds marginal ═══
// Cadence de référence : 1 œuf gratuit / 6h = 4/jour.
// Odds calibrées pour offrir ~62-70% de chance d'obtenir au moins 1 pet de cette
// rareté sur la période cible, via la formule 1-(1-p)^n :
//   Rare       → 1 par semaine   (n=28  tirages) → p≈3.57%
//   Épique     → 1 par 2 semaines(n=56  tirages) → p≈1.79%
//   Légendaire → 1 par 3 semaines(n=84  tirages) → p≈1.19%
//   Ancestral  → 1 par mois      (n=120 tirages) → p≈0.83%
const EGG_TYPES=[
  {id:'basic',   name:'Œuf Basique', ico:'🥚', cost:scaleCost(0),     costLabel:costLabelFor(scaleCost(0)), odds:[55.57,37.05,3.57,1.79,1.19,0.83]},
  {id:'silver',  name:'Œuf Argenté', ico:'🥈', cost:scaleCost(800),   costLabel:costLabelFor(scaleCost(800)),   odds:[54.78,36.52,3.96,2.04,1.45,1.25]},
  {id:'gold',    name:'Œuf Doré',    ico:'🥇', cost:scaleCost(8000),  costLabel:costLabelFor(scaleCost(8000)), odds:[53.49,35.66,4.43,2.56,1.89,1.97]},
  {id:'platinum',name:'Œuf Platine', ico:'💠', cost:scaleCost(40000), costLabel:costLabelFor(scaleCost(40000)),odds:[51.80,34.54,4.68,3.33,2.74,2.91]},
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
  {rar:2, targetPct:14,  cost:6000},   // Rare
  {rar:3, targetPct:7,   cost:20000},  // Épique
  {rar:4, targetPct:3.5, cost:60000},  // Légendaire
  {rar:5, targetPct:2,   cost:150000}, // Ancestral
];
TARGETED_EGG_DEFS.forEach(def=>{
  const cost = scaleCost(def.cost);
  EGG_TYPES.push({
    id:'target_'+def.rar,
    name:`Œuf ${RARITIES[def.rar].name}`,
    ico:'🎯',
    cost,
    costLabel:costLabelFor(cost),
    odds:makeTargetedOdds(def.rar, def.targetPct),
    targeted:true,
    targetRar:def.rar,
  });
});

// Économie fermée (2026-07-19, demande explicite) : ce Silver/inventaire est propre
// au module Compagnons, totalement indépendant du Silver/inventaire du jeu principal.
let SILVER = 55000; // solde de départ pour tester les tiers d'œufs
// compteur À VIE (2026-07-20, demande explicite : "argent depensé") -- jamais remis à 0, contraire
// à SILVER qui peut monter et descendre. Incrémenté à chaque dépense réelle (achat d'œuf,
// hatch.js) -- voir sumSpent() plus bas pour le seul point d'entrée d'incrément.
let silverSpent = 0;
function spendSilver(amount){ SILVER -= amount; silverSpent += amount; }

// ═══ PITY COUNTER ═══ Garantit un Ancestral après trop d'éclosions sans en avoir eu
// (protection contre la malchance extrême — sans ça, en pur RNG, un joueur pourrait
// théoriquement ne jamais en voir un). 500 éclosions ≈ 4 mois à 1 œuf gratuit/6h.
const PITY_THRESHOLD = 500;
let hatchCountSincePity = 0;
let pityEverTriggered = false;
// migration rétroactive (2026-07-19, demande explicite : "supprime les 48 pet pour tout le
// monde") -- le roster de départ est passé de X pets à 0 (voir roster.js, 2026-07-10),
// mais les sauvegardes locales déjà existantes gardaient leur roster antérieur (localStorage n'est
// jamais réécrit tout seul). Ce flag, posé UNE SEULE FOIS par joueur (voir loadGame/importSave,
// companions.save.js), vide le roster au tout premier chargement suivant ce changement -- même
// esprit que les migrations rétroactives du jeu principal (S.migratedXxxVNNN, CLAUDE.md §13),
// adapté ici puisque ce module n'a pas de compte Supabase (sauvegarde 100% locale).
let petsRosterResetV1 = false;
// migration rétroactive (2026-07-20, demande explicite : "supprime tout compagnon au dessus de la
// limite") -- PET_ROSTER_CAP=96 (roster.js) bloque désormais tout NOUVEL hatch au-delà,
// mais une sauvegarde déjà constituée AVANT ce plafond pouvait dépasser 96 -- ce flag, posé UNE
// SEULE FOIS (voir trimRosterToCapIfNeeded()/loadGame(), companions.save.js), purge l'excédent au
// premier chargement suivant l'ajout du plafond. Même esprit que petsRosterResetV1 ci-dessus.
let petsRosterCapV1 = false;
// migration rétroactive (2026-07-10, marché d'échange) -- voir migratePetUidV1(), companions.save.js
let petsUidV1 = false;
// compteur À VIE (2026-07-19, demande explicite : stats admin) -- distinct de
// hatchCountSincePity (remis à 0 à chaque pity déclenché) : jamais réinitialisé, incrémenté
// une seule fois par tirage réel dans rollAndCreatePet() (hatch.js), peu importe le
// chemin (slot d'incubation OU éclosion instantanée ×1/×5/×10).
let totalHatched = 0;

// ═══ TRACKING POUR ACHIEVEMENTS ═══
let fusionCount = 0;
let caphrasUpgradeCount = 0;
let bossItemFound = false;
let breakthroughCount = 0;
let eggTypesUsed = new Set();
let completedAchievements = new Set();
// achievement "dur" (2026-07-20, demande explicite : "succes dure genre fusionner pour perdre
// des legendaire/ancestral") -- la fusion ne DÉTRUIT jamais un pet (executeFusion, companions.fusion.js,
// consomme toujours 2 pets pour en recréer 1), mais peut faire RETOMBER la rareté du résultat sous
// celle du meilleur des deux parents (tirage défavorable). Incrémenté dans executeFusion() quand le
// meilleur parent était Légendaire(4)/Ancestral(5) ET que le résultat sort à une rareté inférieure --
// jamais remis à 0, achievement "hard" débloqué à la 1ère occurrence (voir companions.achievements.js).
let fusionLostHighRarityCount = 0;

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
