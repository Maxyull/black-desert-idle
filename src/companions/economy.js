// Version affichée en bas à gauche du module (2026-07-20, demande explicite : "ajoute version en
// bas a gauche") -- réutilise la MÊME numérotation "VNNN" que le reste du jeu (meta/patch-notes-
// data.js), plutôt qu'un compteur séparé propre à ce module : ce dossier ne peut pas charger
// meta/patch-notes-data.js (scope global distinct, iframe isolée), donc pas de lecture automatique
// possible -- à bumper à la main ici à chaque patch note qui touche sub:'compagnon'.
const COMPANION_MODULE_VERSION = 'V481';

// ═══ BALANCE ═══ (2026-07-18, demande explicite : "remets le divisor à 1, on passe en prod")
// Les coûts Silver et timers passent en VRAIES valeurs (divisor = 1). scaleCost()/scaleTimer()
// deviennent l'identité mais restent en place comme hook de test : repasser TEST_BALANCE_DIVISOR
// à 1000 rétablit le mode "test rapide" sans toucher aucune autre ligne.
const TEST_BALANCE_DIVISOR = 1;
// ═══ RENDEMENT DE FARM ═══ (2026-07-18, demande explicite : "les compagnons vont farm au moins 5x
// plus") -- multiplie le RENDEMENT de chaque loot (quantités d'objets et silver), sans toucher aux
// probabilités : 1 drop reste 1 drop, mais rapporte FARM_YIELD_MULT fois plus. Référencé au SEUL
// point de rendement dans ticks.js (tick live) ET save.js (rattrapage hors-ligne) pour ne jamais
// désynchroniser les deux calculs. Exclut l'item de Boss (jackpot rarissime, jamais multiplié).
const FARM_YIELD_MULT = 5;
/** @param {number} v - coût réel en silver. @returns {number} coût réduit par TEST_BALANCE_DIVISOR (min 1 si v>0, 0 si gratuit). */
function scaleCost(v){ return v>0 ? Math.max(1, Math.round(v/TEST_BALANCE_DIVISOR)) : 0; }
/** @param {number} v - durée réelle en secondes. @returns {number} durée réduite par TEST_BALANCE_DIVISOR (min 1s). */
function scaleTimer(v){ return Math.max(1, Math.round(v/TEST_BALANCE_DIVISOR)); }
/** @param {number} v - coût (déjà réduit par scaleCost). @returns {string} libellé affiché ("Gratuit" si 0). */
function costLabelFor(v){ return v>0 ? `${v.toLocaleString(NUM_LOCALE)} Silver` : i18next.t('companions:companions.economy.free'); }

// ═══ TYPES D'ŒUFS — coût qui explose pour un gain d'odds marginal ═══
// Cadence de référence : 1 œuf gratuit / 6h = 4/jour.
// ÉCHELLE DE QUALITÉ (2026-07-18, refonte "trouve une logique cohérente, quitte à supprimer des
// œufs") : les anciens œufs (Basique→Platine) ne différaient quasi pas -- payer 40 000 vs gratuit
// ne faisait passer le Rare que de 3,57 % à 4,68 %. Et 4 œufs "ciblés" boostaient d'autant MOINS
// qu'ils coûtaient cher (Ancestral +1,2 % pour 150 000). Aucune raison de payer.
//
// Nouvelle logique, simple et lisible : 4 paliers, et à CHAQUE palier la masse se décale nettement
// vers le haut -- le Commun s'effondre (60 → 15 %) pendant que TOUTES les hautes raretés montent de
// façon monotone. Ancestral : 0,2 % → 3 % (×15 au dernier palier). Prix ×10 par palier. Chaque œuf
// a enfin une identité. Les 4 œufs "ciblés" sont SUPPRIMÉS (redondants et à récompense inversée).
// Chaque ligne d'odds somme bien à 100.
// Prix (2026-07-18, demande explicite "changer le prix des œufs", palier ×100 plus cher) : le silver
// est désormais celui du JEU (pool partagé, bien plus abondant), les prix montent en conséquence --
// Gratuit / 500 000 / 5 000 000 / 50 000 000 (échelle ×10 conservée entre paliers).
// tierOdds (2026-07-18, demande explicite : "chance d'éclore un tier 1 à 5 selon l'œuf") : chance
// d'éclore DIRECTEMENT à un tier T1→T5 (5 valeurs, somment à 100), distinctes des odds de rareté.
// Avant, tout pet éclosait en T1 (le tier ne se gagnait qu'à l'XP). Distribution "conservatrice"
// (choix explicite) : T1 reste la norme, les hauts tiers à l'éclosion sont un vrai jackpot qui
// s'améliore nettement avec la qualité de l'œuf (Platine T5 = 1 % vs Basique 0,02 %).
const EGG_TYPES=[
  {id:'basic',   name:'Œuf Basique', ico:'🥚', cost:scaleCost(0),        costLabel:costLabelFor(scaleCost(0)),        odds:[60,30, 7, 2,0.8,0.2], tierOdds:[97, 2.5, 0.4, 0.08, 0.02]},
  {id:'silver',  name:'Œuf Argenté', ico:'🥈', cost:scaleCost(500000),   costLabel:costLabelFor(scaleCost(500000)),   odds:[45,33,14, 5, 2,  1], tierOdds:[90, 8,   1.5, 0.4,  0.1 ]},
  {id:'gold',    name:'Œuf Doré',    ico:'🥇', cost:scaleCost(5000000),  costLabel:costLabelFor(scaleCost(5000000)),  odds:[30,32,22,10, 4,  2], tierOdds:[78, 16,  4.5, 1.2,  0.3 ]},
  {id:'platinum',name:'Œuf Platine', ico:'💠', cost:scaleCost(50000000), costLabel:costLabelFor(scaleCost(50000000)), odds:[15,28,28,18, 8,  3], tierOdds:[60, 25,  10,  4,    1   ]},
];

// Pool de silver PARTAGÉ avec le jeu (2026-07-18, demande explicite : "silver bidirectionnel, on
// lie compagnon avec le jeu") -- le module Compagnon ne tient plus une bourse fermée : il partage
// le silver du jeu principal (S.silver). SILVER ci-dessous n'est plus qu'un MIROIR local, resync
// depuis l'hôte à chaque affichage (voir silverHost/syncSilverFromHost). La valeur 55000 ne sert
// que de repli quand l'hôte est absent (module ouvert en standalone / tests hors iframe).
let SILVER = 55000;
// compteur À VIE (2026-07-20, demande explicite : "argent depensé") -- jamais remis à 0. Incrémenté
// à chaque dépense réelle (achat d'œuf/slot), indépendant du pont (mesure l'activité du module).
let silverSpent = 0;

// ═══ PONT SILVER (pool partagé) ═══ Accès au silver du jeu via window.parent (iframe same-origin)
// et les accesseurs `function` de l'hôte (getGameSilverForCompanion/addGameSilverForCompanion,
// game-supabase.js). Toute dépense/gain passe par addSilver côté jeu (catégorie 'companion',
// tracée dans l'onglet admin Silver). Repli silencieux sur le SILVER local si l'hôte est absent.
/** @returns {?Window} fenêtre hôte si le pont est disponible (accesseurs présents ET solde lisible), sinon null. */
function silverHost(){
  try{
    const w = window.parent;
    if(w && w!==window && typeof w.getGameSilverForCompanion==='function' && typeof w.addGameSilverForCompanion==='function'){
      if(typeof w.getGameSilverForCompanion()==='number') return w;
    }
  }catch(e){}
  return null;
}
/** Resynchronise le miroir SILVER local depuis le silver du jeu quand le pont est actif (no-op en repli local). */
function syncSilverFromHost(){
  const w = silverHost();
  if(w) SILVER = w.getGameSilverForCompanion();
}
/** @param {number} amount - montant à dépenser (>0). Débite le silver PARTAGÉ (jeu via addSilver, sinon miroir local) et incrémente silverSpent (compteur à vie). */
function spendSilver(amount){
  const w = silverHost();
  if(w){ w.addGameSilverForCompanion(-amount, 'compagnon:achat'); SILVER = w.getGameSilverForCompanion(); }
  else { SILVER -= amount; }
  silverSpent += amount;
}
/** @param {number} amount - montant gagné (>0). @param {string} [note] - contexte pour le registre admin. Crédite le silver PARTAGÉ (jeu via addSilver, sinon miroir local). */
function earnSilver(amount, note){
  if(!amount) return;
  const w = silverHost();
  if(w){ w.addGameSilverForCompanion(amount, note||'compagnon'); SILVER = w.getGameSilverForCompanion(); }
  else { SILVER += amount; }
}

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
// save.js), vide le roster au tout premier chargement suivant ce changement -- même
// esprit que les migrations rétroactives du jeu principal (S.migratedXxxVNNN, CLAUDE.md §13),
// adapté ici puisque ce module n'a pas de compte Supabase (sauvegarde 100% locale).
let petsRosterResetV1 = false;
// migration rétroactive (2026-07-20, demande explicite : "supprime tout compagnon au dessus de la
// limite") -- PET_ROSTER_CAP=96 (roster.js) bloque désormais tout NOUVEL hatch au-delà,
// mais une sauvegarde déjà constituée AVANT ce plafond pouvait dépasser 96 -- ce flag, posé UNE
// SEULE FOIS (voir trimRosterToCapIfNeeded()/loadGame(), save.js), purge l'excédent au
// premier chargement suivant l'ajout du plafond. Même esprit que petsRosterResetV1 ci-dessus.
let petsRosterCapV1 = false;
// migration rétroactive (2026-07-10, marché d'échange) -- voir migratePetUidV1(), save.js
let petsUidV1 = false;
// migration rétroactive (2026-07-21, demande explicite : "lorsqu'on passe a la rareté superieur,
// on change de nom et on prend les noms de la rareté superieur") -- avant ce changement,
// BREAKTHROUGH (ticks.js) augmentait p.rar SANS jamais réassigner p.cat (espèce/nom), laissant
// un pet affiché sous un nom d'espèce qui ne correspondait plus à sa vraie rareté (source de la
// confusion Index/Sections/Collection corrigée juste avant). Ce flag, posé UNE SEULE FOIS (voir
// migratePetSpeciesRarityV1()/loadGame(), save.js), réaligne p.cat sur la bonne espèce (même
// section, rareté = p.rar réel -- structure 1 espèce par section×rareté, voir catalog.js) pour
// tout pet déjà "percé" avant ce correctif.
let petsSpeciesRarityV1 = false;
// migration rétroactive (2026-07-18, demande explicite : "au moment du merge on supprimera tout et
// les compagnons vont farm plus") -- passage en prod (vraies valeurs, farm ×5, silver PARTAGÉ avec
// le jeu) : on repart d'une base de farm PROPRE pour que les hoards de la phase de test (inventaires
// de dizaines de milliers, rosters/slots de test) ne polluent pas la nouvelle économie. Réinitialise
// UNE SEULE FOIS pets/inventaire/slots/compteurs de tirage (voir wipeEconomyForProdV1(), save.js).
// NE TOUCHE PAS : le silver (désormais celui du JEU, pool partagé -- pas la bourse du module) ni
// completedAchievements (récompenses déjà versées -- éviter tout re-versement de silver réel).
let petsEconomyWipeV1 = false;
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
// des legendaire/ancestral") -- la fusion ne DÉTRUIT jamais un pet (executeFusion, fusion.js,
// consomme toujours 2 pets pour en recréer 1), mais peut faire RETOMBER la rareté du résultat sous
// celle du meilleur des deux parents (tirage défavorable). Incrémenté dans executeFusion() quand le
// meilleur parent était Légendaire(4)/Ancestral(5) ET que le résultat sort à une rareté inférieure --
// jamais remis à 0, achievement "hard" débloqué à la 1ère occurrence (voir achievements.js).
let fusionLostHighRarityCount = 0;

// ═══ STREAK DE CONNEXION QUOTIDIENNE ═══
// Récompense croissante sur 7 jours consécutifs, reset si un jour est manqué.
let loginStreak = 0;
let lastLoginDate = null; // format 'YYYY-MM-DD'
const STREAK_REWARDS = [
  {silver:5,  bonus:null},
  {silver:8,  bonus:null},
  {silver:12, bonus:null},
  {silver:18, bonus:'silver_egg'}, // clé companions.streak.bonus_silver_egg (i18n), plus un libellé affiché tel quel
  {silver:25, bonus:null},
  {silver:35, bonus:null},
  {silver:60, bonus:'gold_egg'}, // clé companions.streak.bonus_gold_egg
];

/** @returns {string} date du jour au format 'YYYY-MM-DD' (fuseau local). */
function todayStr(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
/** @param {string} d1 @param {string} d2 - dates 'YYYY-MM-DD'. @returns {number} nombre de jours entiers entre d1 et d2. */
function daysBetween(d1,d2){
  return Math.round((new Date(d2)-new Date(d1))/86400000);
}

/** Vérifie/actualise le streak de connexion quotidienne (incrémente si jour consécutif, reset sinon), verse la récompense STREAK_REWARDS du jour et l'affiche. No-op si déjà connecté aujourd'hui. */
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
  earnSilver(reward.silver, 'compagnon:streak');
  updateSilverDisplay();

  let msg = i18next.t('companions:companions.streak.toast', {day:loginStreak, silver:reward.silver});
  const bonusLabel = reward.bonus ? i18next.t(COMPANIONS_NS_PREFIX+'companions.streak.bonus_'+reward.bonus) : '';
  if(reward.bonus){
    // Bonus spécial : œuf gratuit accordé directement dans la réserve d'incubation si un slot est libre
    const freeSlotIdx = incubSlots.findIndex(s=>!s.locked && !s.ready);
    if(freeSlotIdx>=0){ incubSlots[freeSlotIdx].tl=0; incubSlots[freeSlotIdx].ready=true; }
    msg += ` + ${bonusLabel} !`;
  }
  toast('🔥', msg);
  addGameLog(i18next.t('companions:companions.streak.log_html', {day:loginStreak, silver:reward.silver})+(reward.bonus?' + '+bonusLabel:''));
}

// ═══ INVENTAIRE & JOURNAL — alimentés par les pets sur le terrain ═══
let INVENTORY = {}; // { "Minerai de fer": 12, ... }
let GAME_LOG = [];  // liste de {t, text}

/** @param {string} itemName @param {string} icon @param {number} qty - quantité à ajouter. @param {number} [feed] - valeur nutritive (maintenue à jour même sur un stack existant). Ajoute/incrémente un objet dans INVENTORY. */
function addToInventory(itemName, icon, qty, feed){
  if(!INVENTORY[itemName]) INVENTORY[itemName] = {icon, qty:0, feed:feed||0};
  INVENTORY[itemName].qty += qty;
  if(feed!==undefined) INVENTORY[itemName].feed = feed; // garde la valeur nutritive à jour
}
// ═══ VENTE (2026-07-18) — donne un usage à TOUT le loot ═══════════
// Avant, le champ `v` des drops ne servait QU'au seuil "rare" du log (v>=200). Il devient la valeur
// de revente en silver. Résout deux problèmes d'un coup : le loot mort (Dopi ~74k, items de Boss --
// jamais consommés) et la surabondance de nourriture (commun par dizaines de milliers, l'auto-feed
// n'en consomme presque rien). L'excédent se convertit en silver au lieu de s'entasser sans fin.
// Construit UNE FOIS au chargement depuis les mêmes définitions que les drops (catalog.js, chargé
// avant ce fichier) -- aucune valeur dupliquée à la main.
const ITEM_SELL_VALUES = (()=>{
  const m = {};
  SECTIONS.forEach(sec => sec.drops.forEach(d => { if(!d.silver) m[d.n] = d.v; }));
  m[CAPHRAS_ITEM.n] = CAPHRAS_ITEM.v;
  DOPI_ITEMS.forEach(d => { m[d.n] = d.v; });
  Object.values(BOSS_ITEMS).forEach(b => { m[b.n] = b.v; });
  return m;
})();
// ressources spéciales : vendables à l'unité (choix du joueur), mais JAMAIS balayées par le bouton
// "tout vendre le commun" -- même esprit que l'exclusion de l'auto-nourrissage (feed.js/ticks.js),
// pour ne pas dumper par accident du Caphras (matériau d'atelier) ou un item de Boss (jackpot).
const SELL_SPECIAL_NAMES = new Set([CAPHRAS_ITEM.n, ...DOPI_ITEMS.map(d=>d.n), ...Object.values(BOSS_ITEMS).map(b=>b.n)]);
const SELL_COMMON_THRESHOLD = 200; // "commun" = valeur unitaire < 200 (le seuil déjà utilisé pour le log rare)

/** @param {string} name @returns {number} valeur de revente unitaire en silver (0 si non vendable). */
function sellValueOf(name){ return ITEM_SELL_VALUES[name] || 0; }

/** @param {string} name. Vend TOUTE la pile d'un objet : crédite sellValueOf×qty en silver, retire l'objet de l'inventaire. No-op si absent/non vendable. */
function sellItem(name){
  const it = INVENTORY[name]; if(!it) return;
  const val = sellValueOf(name); if(val<=0) return;
  const gain = val * it.qty;
  earnSilver(gain, 'compagnon:vente');
  delete INVENTORY[name];
  toast('💰', i18next.t('companions:companions.sell.sold_one', {qty:it.qty, name:itemLabel(name), silver:gain.toLocaleString(NUM_LOCALE)}));
  updateSilverDisplay(); renderGameInventory(); if(typeof renderCollInventory==='function') renderCollInventory();
}

/** Vend d'un coup tout le loot COMMUN (valeur unitaire < SELL_COMMON_THRESHOLD), en gardant intacts les rares ET les ressources spéciales (Caphras/Dopi/Boss). */
function sellAllCommon(){
  let total = 0, count = 0;
  Object.entries(INVENTORY).forEach(([name, it]) => {
    if(SELL_SPECIAL_NAMES.has(name)) return;
    const val = sellValueOf(name);
    if(val<=0 || val>=SELL_COMMON_THRESHOLD) return; // garde le rare (v>=200) et le non-vendable
    total += val * it.qty; count += it.qty;
    delete INVENTORY[name];
  });
  if(count<=0){ toast('📦', i18next.t('companions:companions.sell.nothing_common')); return; }
  earnSilver(total, 'compagnon:vente');
  toast('💰', i18next.t('companions:companions.sell.sold_all', {count:count.toLocaleString(NUM_LOCALE), silver:total.toLocaleString(NUM_LOCALE)}));
  updateSilverDisplay(); renderGameInventory(); if(typeof renderCollInventory==='function') renderCollInventory();
}

/** @param {string} text - HTML de la ligne. Ajoute une entrée horodatée en tête de GAME_LOG (plafonné à 40 entrées). */
function addGameLog(text){
  const now=new Date();
  const t=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  GAME_LOG.unshift({t, text});
  if(GAME_LOG.length>40) GAME_LOG.pop();
}
