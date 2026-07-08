'use strict';
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
const $ = id => document.getElementById(id);
// le canvas a une résolution interne FIXE (1240×440, voir <canvas>) que le CSS (width:100%) réduit
// pour tenir dans un téléphone — tout texte dessiné dessus (floatTxt : gains de loot/XP, dégâts...)
// rétrécit donc dans les mêmes proportions et devient minuscule sur mobile (2026-07-05, demande
// explicite : "met en valeur le changement de XP/LOOT"). uiTextScale() compense en agrandissant les
// polices dans le repère du canvas d'autant que l'affichage réel a rétréci, pour une taille visuelle
// ~constante à l'écran quelle que soit la largeur ; plafonné pour rester lisible sans être absurde.
function uiTextScale() { return Math.min(3.2, Math.max(1, 1240 / (cv.clientWidth || 1240))); }
// détecte un client mobile/tablette (2026-07-05, adaptation mobile) : sert à choisir un état
// replié par DÉFAUT pour les panneaux flottants (menu, chat, suivi) qui se chevauchent sinon sur un
// petit écran (voir les media queries ci-dessus) — un simple seuil de largeur de viewport suffit
// (pas besoin de sniffer le user-agent, le responsive suit déjà la taille réelle de la fenêtre)
function isMobileViewport() { return window.innerWidth <= 1024; }
// échappe pseudo/message avant insertion via innerHTML — ce sont des chaînes saisies par
// d'autres joueurs, jamais dignes de confiance (évite une injection XSS stockée dans le chat)
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ==================== I18N (déclaré tôt : utilisé dès les premiers rendus) ====================
let LANG = 'fr';
try { LANG = localStorage.getItem('velia-idle-lang') || 'fr'; } catch(e) {}
// traduction des noms dynamiques (zones, mobs, objets) — clé = texte FR d'origine
const NAME_EN = {
  // zones
  'Camp des Loups':'Wolf Camp', 'Ruines de Protty':'Protty Ruins', 'Repaire des Pirates':'Pirate Den',
  'Camp Rhutum':'Rhutum Camp', 'Ferme Shultz':'Shultz Farm', 'Colonie Sausan':'Sausan Colony',
  'Mine de Fer Abandonnée':'Abandoned Iron Mine', 'Poste Helm':'Helm Post',
  'Repaire Bandits Gahaz':'Gahaz Bandit Lair', 'Sanctuaire Elric':'Elric Shrine', 'Ruines de Kratuga':'Kratuga Ruins',
  'Planque des Mânes':'Manes\' Hideout',
  // 4e zone de chaque palier (2026-07-05, demande explicite) : complète la rotation avec la
  // boucle d'oreille manquante — reqAP/reqDP volontairement identiques à la dernière zone du
  // palier (voir le commentaire sur Planque des Mânes), aucun changement du plafond de stat
  'Ruines de Trent':'Trent Ruins', 'Île d\'Iliya':'Iliya Island', 'Base de Bashim':'Bashim Base', 'Forêt de Polly':'Polly Forest',
  // mobs
  'Loup':'Wolf', 'Esprit de Protty':'Protty Spirit', 'Pirate':'Pirate', 'Guerrier Rhutum':'Rhutum Warrior',
  'Garde Shultz':'Shultz Guard', 'Combattant Sausan':'Sausan Fighter', 'Mineur corrompu':'Corrupted Miner',
  'Soldat Helm':'Helm Soldier', 'Bandit Gahaz':'Gahaz Bandit', 'Sectateur d\'Elric':'Elric Cultist', 'Uluan':'Uluan',
  'Esprit des Mânes':'Manes Spirit',
  'Troll des Ruines':'Ruins Troll', 'Pirate d\'Iliya':'Iliya Pirate', 'Soldat de Bashim':'Bashim Soldier', 'Troll de Polly':'Polly Troll',
  // trash loot
  'Viande de loup':'Wolf Meat', "Lame rouillée d'Imp":"Rusty Imp Blade", 'Insigne de Sausan':'Sausan Badge',
  'Bourse de pirate':'Pirate Purse', 'Croc de Naga':'Naga Fang', 'Oreille de Fogan':'Fogan Ear',
  'Fer rouillé':'Rusted Iron', 'Fourrure de Biraghi':'Biraghi Fur', "Défense d'orc":'Orc Tusk',
  'Éclat de relique ancienne':'Ancient Relic Shard', "Relique d'Hystria":'Hystria Relic', 'Icône de Rhasia':'Rhasia Icon',
  'Larme de Mâne':'Manes\' Tear',
  'Pierre de Trent':'Trent Stone', 'Perle d\'Iliya':'Iliya Pearl', 'Insigne de Bashim':'Bashim Badge', 'Mousse de Polly':'Polly Moss',
  // notes de la table de loot
  'revenu de base':'base income', 'optimisation':'enhancement', 'arme/armure (5 pièces)':'weapon/armor (5 pieces)',
  'craft endgame':'endgame crafting',
  // matériaux
  'Pierre noire':'Black Stone', 'Éclat de cristal noir tranchant':'Sharp Black Crystal Shard',
  'Éclat de cristal noir dur':'Hard Black Crystal Shard', 'Poussière d\'esprit ancien':'Ancient Spirit Dust',
  'Pierre de Caphras':'Caphras Stone', 'Fragment de mémoire':'Memory Fragment', 'Marbre du Dieu déchu':'Fallen God\'s Marble',
  // bijoux (jackpot) — noms alignés sur les vrais objets BDO par palier de stuff le 2026-07-06
  'Anneau Naru':'Naru Ring', 'Collier Naru':'Naru Necklace', 'Ceinture Naru':'Naru Belt',
  'Anneau Tuvala':'Tuvala Ring', 'Collier Tuvala':'Tuvala Necklace', 'Ceinture Tuvala':'Tuvala Belt',
  'Anneau Asula':'Asula Ring', 'Collier Asula':'Asula Necklace', 'Ceinture Asula':'Asula Belt',
  'Anneau de Cadry':'Cadry Ring', 'Collier du Dieu déchu':'Fallen God\'s Necklace',
  // boucles d'oreille (2026-07-05) : complètent la rotation de bijoux de chaque palier (il ne
  // manquait que ce slot — voir ACC_SLOTS earring1/earring2, jusque-là jamais alimenté en jeu)
  'Boucle Naru':'Naru Earring', 'Boucle Tuvala':'Tuvala Earring', 'Boucle Asula':'Asula Earring', "Tungrad's Earring":"Tungrad's Earring",
  // gear sets
  'Grunil / Yuria':'Grunil / Yuria', 'Boss (Kzarka, Bheg, Urugon…)':'Boss (Kzarka, Bheg, Urugon…)',
  // badges de zone
  'ZONE DANGEREUSE':'DANGEROUS ZONE', 'ZONE DIFFICILE':'HARD ZONE', 'ZONE ADAPTÉE':'SUITABLE ZONE',
  'ZONE FACILE':'EASY ZONE', 'ZONE DÉPASSÉE':'TRIVIAL ZONE',
  'DANGEREUSE':'DANGEROUS', 'DIFFICILE':'HARD', 'ADAPTÉE':'SUITABLE', 'FACILE':'EASY', 'DÉPASSÉE':'TRIVIAL',
  // mode IA
  'équilibré':'balanced', 'défensif':'defensive', 'overgeared':'overgeared',
};
function tr(s) { if (LANG !== 'en' || !s) return s; return NAME_EN[s] || s; }

// ZONES est desormais defini dans world/zones-data.js (extrait le 2026-07-08,
// reorganisation par dossiers) -- charge AVANT ce fichier, voir index.html.
let zoneIdx = 0;
// devient true une fois la vraie sauvegarde cloud chargée (ou d'emblée si Supabase n'est pas
// configuré) -- avant ça, S contient encore les valeurs par défaut (ex: lastLoyaltyDate vide),
// ce qui déclenchait à tort le cadeau de fidélité (et son toast) à CHAQUE connexion, avant même
// que la vraie sauvegarde n'arrive (bug remonté en jeu le 2026-07-05)
let saveReady = false;
let atVelia = false; // true quand le perso est à Velia (zone paisible, aucun monstre — voir goToVelia)
let autoOptTimer = null, autoOptTargetLvl = null; // optimisation automatique jusqu'à un palier choisi (voir startAutoOpt)
let lastLootEntry = null; // dernière ligne du loot ticker, pour fusionner les drops identiques consécutifs
const Z = () => ZONES[zoneIdx];

// ==================== ÉTAT GLOBAL ====================
const S = {
  silver: 0, kills: 0, lootCount: 0, lvl: 1, xp: 0, xpNext: 1, // xpNext = LEVEL_XP_TABLE[lvl] (voir gainXp)
  pa: 4, dp: 10,   // PA innée (le gros vient de l'arme équipée ci-dessous)
  castMult: 1, hpMax: 100, mpMax: 100, lootRadius: 26, // mpMax (2026-07-05) : réserve de mana, voir SKILLS[].mp et usePotionMana()
  bossesKilled: {}, // Compendium World Boss (2026-07-08) : { [bossId]: true } dès qu'un World Boss a été vaincu au moins une fois (voir compendiumBossCount)
  penMastery: {}, // Compendium spécial "Maîtrise PEN" (2026-07-08) : { [itemName]: true } dès que cet objet a atteint PEN au moins une fois (voir markPenMastery)
  enhPeakByName: {}, // meilleur niveau d'optimisation JAMAIS atteint par nom d'objet (2026-07-15) : { [itemName]: enhLv }, voir trackEnhPeak -- survit à la vente de l'objet
  lootTableVersion: 'v2', // 'v1' (par zone, historique) ou 'v2' (taux fixe par palier, 2026-07-15) -- voir gearDropChance/jewelDropChance, réversible à tout moment via l'admin
  costPA: 60, costDP: 55, costCast: 90, costHP: 70, costLoot: 110,
  startTime: performance.now(), silverEarned: 0,
  // baseline (silverEarned/kills au début de LA SESSION EN COURS), pour calculer un vrai "silver/h"
  // et "kills/min" de session — S.silverEarned et S.kills sont des compteurs À VIE (achievements
  // "gagne X silver au total" etc.) et ne doivent jamais être réinitialisés au chargement d'une
  // sauvegarde. C'est S.startTime qui posait problème : restauré tel quel depuis le cloud, il ne
  // correspond plus au performance.now() de la NOUVELLE page, ce qui pouvait diviser un
  // silverEarned à vie énorme par un temps quasi nul → chiffre astronomique (faux positif
  // anti-triche confirmé le 2026-07-06). Corrigé en réinitialisant startTime + ces baselines à
  // chaque chargement (voir applySaveState).
  silverEarnedAtLoad: 0, killsAtLoad: 0,
  // "silver par heure" affiché (#shRate) = UNIQUEMENT le trash/token vendu au sol (2026-07-12,
  // demande explicite : "compté exclusivement par les silver recolté grace au token vendu") --
  // compteur À VIE séparé de silverEarned (qui reste global, toutes sources, pour les succès), voir
  // addSilver(). tokenSilverEarnedAtLoad = même principe de baseline de session que silverEarnedAtLoad.
  tokenSilverEarned: 0, tokenSilverEarnedAtLoad: 0,
  bestKpm: 0, // record personnel de kills/min À VIE (voir refreshStatsOnly) — sert au classement "🏹 Record kills/min"
  maxZoneIdx: 0, playtimeSec: 0, lootByItem: {},
  enhAttempts: 0, travelCount: 0, jackpotCount: 0, gearDropCount: 0, enhSuccess: 0,
  achUnlocked: {}, dq: null, wq: null, questTrackerOn: false,
  loyalty: 0, lastLoyaltyDate: null, mailbox: [],
  notifLog: [], // centre de notifications (2026-07-08) : persisté (survit au reload/reconnexion), auto-purgé après 7 jours (voir pruneNotifLog)
  lastDeathAt: 0, // horodatage de la dernière mort — 0 = jamais mort (voir endBossFight, bonus "certifié sans mort")
  potionType: 'medium', // 'small'/'medium'/'large'/'mega' = potions payantes ; 'infinite' = gratuite (débloquée plus tard)
  farmMode: 'loot', // 'loot' = ramasse tout avant le pack suivant ; 'xp' = enchaîne les packs sans se soucier du loot
  // mode de combat IA choisi MANUELLEMENT par le joueur (2026-07-14, demande explicite : "ajoute
  // le fais de pouvoir changer l'ia manuellement" -- remplace l'ancien calcul auto via bottleneck()
  // de gear, voir aiMode()) : 'défensif' | 'équilibré' | 'overgeared'
  aiCombatMode: 'équilibré',
  potionThreshold: 0.5, // % de PV en dessous duquel l'IA boit une potion automatiquement (réglable via le slider)
  useCronStone: false, // 2026-07-06 : au choix du joueur (case à cocher) si elle protège une rétrogradation, plus automatique en silence -- désactivée par défaut (2026-07-10, demande explicite), le joueur l'active lui-même s'il en veut
};

// point d'entrée UNIQUE pour toute variation de silver côté client (2026-07-10, demande explicite :
// "toute modification de silver doit être écrit dans ce registre... je dois pouvoir traquer le
// moindre silver") -- centralise S.silver/S.silverEarned ET la journalisation (voir
// queueSilverLedger, game-supabase.js), pour ne plus jamais pouvoir modifier l'un sans l'autre.
// category : identifiant court et STABLE (ex: 'loot','potion','sell','quest','achievement',
// 'welcome','admin_test') -- alimente l'onglet Admin "Silver" (tableau + graphique par catégorie).
function addSilver(delta, category, note) {
  if (!delta) return;
  S.silver += delta;
  if (delta > 0) S.silverEarned += delta;
  // "silver par heure" (2026-07-12, demande explicite : "compté exclusivement par les silver
  // recolté grace au token vendu") -- S.silverEarned (au-dessus) reste un compteur GLOBAL À VIE
  // (toutes sources : quêtes, succès, boss, marché...), utilisé pour les succès/classements. Le
  // HUD "silver/h" (#shRate) doit lui refléter UNIQUEMENT le revenu du trash (token) au sol, pas
  // le loot occasionnel de gros montants (succès/boss/quêtes) qui fausserait la lecture du rythme
  // de farm réel -- voir dropsTick, seul endroit qui appelle addSilver avec category:'loot'.
  if (delta > 0 && category === 'loot') S.tokenSilverEarned = (S.tokenSilverEarned||0) + delta;
  if (typeof queueSilverLedger === 'function') queueSilverLedger(delta, category, note);
}
// suit combien de fois chaque objet a été ramassé (pour "meilleur objet farmé" dans le classement)
function trackLoot(name) { S.lootByItem[name] = (S.lootByItem[name]||0) + 1; }
function bestFarmedItem() {
  let best = null, bestN = 0;
  for (const name in S.lootByItem) if (S.lootByItem[name] > bestN) { best = name; bestN = S.lootByItem[name]; }
  return best ? { name: best, count: bestN } : null;
}

// Icones SVG (svgIcon, shadeHex, ICO_MAT_*, ICO_CRON_STONE, CRON_STONE, JEWEL_TIER_IDX,
// cronStoneCostForItem...) desormais dans inventory/gear-icons.js (extrait le 2026-07-08,
// reorganisation par dossiers) -- charge AVANT ce fichier, voir index.html.

// ==================== INVENTAIRE (192 slots) & ÉQUIPEMENT ====================
const INV_SIZE = 192;
const INV = new Array(INV_SIZE).fill(null);   // chaque slot : null | { key, name, kind, icon, color, qty, unit, val, weight, ap, dp }
const MAX_STACK = 9999;
// Sac "Compendium" (2026-07-08, demande explicite) : même taille que le sac principal (192 cases).
// Quand "Vendre" s'apprête à vendre une pièce d'équipement/bijou dont ce TYPE n'a JAMAIS atteint
// PEN (voir S.penMastery), un exemplaire est déposé ici au lieu d'être vendu — pour ne jamais perdre
// la chance de le monter en PEN plus tard. Toujours le PLUS ENCHANTÉ des exemplaires possédés (voir
// ensureCompendiumProtection, 2026-07-09) : un exemplaire plus enchanté trouvé dans le sac principal
// prend automatiquement la place de celui déjà protégé (souvent un +0), qui retourne dans le sac
// principal — jamais perdu ni détruit.
const COMPENDIUM_BAG = new Array(INV_SIZE).fill(null);
function compendiumBagHasName(name) { return COMPENDIUM_BAG.some(s => s && s.name === name); }
// Coffre de ville (2026-07-16, demande explicite : "on ajoute un onglet coffre lié a la ville
// 20/192 emplacement le reste bloqué") -- rangement personnel séparé du sac principal, même taille
// que lui pour une future extension, mais seuls les 20 premiers emplacements sont utilisables pour
// l'instant (les suivants restent verrouillés 🔒, comme les futures cases RNG/Consommable ailleurs).
const VELIA_CHEST = new Array(INV_SIZE).fill(null);
const VELIA_CHEST_OPEN = 20;
function compendiumBagAdd(obj) {
  const idx = COMPENDIUM_BAG.findIndex(s => s === null);
  if (idx === -1) return false;
  COMPENDIUM_BAG[idx] = { ...obj };
  return true;
}
// filet de sécurité : après une VENTE (sellOne/sellStack, jamais "Jeter") qui touche du gear/jackpot,
// garantit que le sac protégé du Compendium contient toujours le PLUS ENCHANTÉ des exemplaires
// possédés de ce nom tant qu'il n'a jamais atteint PEN (2026-07-09, demande explicite : "l'item
// optimisé qui part dans le compendium à la place du +0, garde son optimisation"). Si un exemplaire
// du sac principal est plus enchanté que celui déjà protégé, il PREND SA PLACE (swap) — l'ancien
// exemplaire protégé (souvent un +0) retourne dans le sac principal, jamais perdu ni détruit. Ne
// touche JAMAIS l'équipement porté (demande explicite) — uniquement le sac principal.
function ensureCompendiumProtection(name) {
  if (!name || S.penMastery[name]) return;
  const curIdx = COMPENDIUM_BAG.findIndex(s => s && s.name === name);
  const current = curIdx !== -1 ? COMPENDIUM_BAG[curIdx] : null;
  let bestIdx = -1, bestEnh = current ? (current.enhLv || 0) : -1;
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i];
    if (!it || it.name !== name || (it.kind !== 'gear' && it.kind !== 'jackpot')) continue;
    const enh = it.enhLv || 0;
    if (enh > bestEnh) { bestEnh = enh; bestIdx = i; }
  }
  if (bestIdx === -1) return; // rien de mieux dans le sac que ce qui est déjà protégé (ou rien du tout)
  const better = INV[bestIdx];
  if (current) {
    if (!invAdd(current)) return; // sac principal plein : annule le swap, rien ne bouge
    COMPENDIUM_BAG[curIdx] = { ...better };
    INV[bestIdx] = null;
  } else if (compendiumBagAdd(better)) {
    INV[bestIdx] = null;
  }
}

// slots d'équipement type BDO — chaque pièce optimisable porte son PROPRE niveau d'enchant (enhLv)
// spawn à vide (2026-07-08, demande explicite : "ne plus spawn avec baton grunil -> spawn a vide")
// -- avant, un "Bâton de Grunil" (nom du palier le plus haut, trompeur pour un objet de départ)
// était équipé par défaut ; le joueur commence désormais sans arme, comme pour tous les autres slots
const EQUIP = {
  weapon: null, awakening: null, secondary: null, book: null,
  helmet: null, armor: null, gloves: null, boots: null,
  ring1: null, ring2: null, necklace: null, earring1: null, earring2: null, belt: null,
  // 2 emplacements Artéfact (ex: Vell, Khan) + 1 emplacement Pierre — pas encore de source de
  // drop en jeu, prêts à l'usage pour une future mise à jour (demande explicite du 2026-07-07)
  artifact1: null, artifact2: null, eqStone: null,
};
const ARMOR_SLOTS = ['helmet','armor','gloves','boots'];
const ACC_SLOTS = ['ring1','ring2','necklace','earring1','earring2','belt','artifact1','artifact2','eqStone'];
const WEAPON_SLOTS = ['weapon','awakening','secondary'];
// tout ce qui peut être optimisé — armes, armure ET bijoux
const OPTIMIZABLE_SLOTS = [...WEAPON_SLOTS, ...ARMOR_SLOTS, ...ACC_SLOTS];


function invWeight() {
  let w = 0;
  for (const s of INV) if (s) w += (s.weight||0.1) * s.qty;
  return w;
}
// LT de base — mesuré empiriquement à ~6.8 LT/min en farm continu zone 1 (personnage neuf),
// calibré pour ~2h de farm avant ralentissement. Augmentable plus tard via une boutique.
const MAX_WEIGHT = () => 800;
function invUsed() { return INV.filter(s => s).length; }

// ajoute un objet à l'inventaire (stack si possible). retourne false si plein.
function invAdd(obj) {
  if (obj.stackable) {
    const slot = INV.find(s => s && s.key === obj.key && s.qty < MAX_STACK);
    if (slot) { slot.qty += obj.qty; enforceTreasureStackCap(slot); return true; }
  }
  const idx = INV.findIndex(s => s === null);
  if (idx === -1) return false; // inventaire plein
  // horodatage d'entrée dans le sac (2026-07-09, demande explicite) -- sert à détecter un meilleur
  // stuff laissé sans y toucher plus de 15s (voir hasNeglectedUpgradeInBag) ; ne l'écrase pas si
  // déjà présent (ex: un objet qui revient dans le sac après un déséquipement garde sa date d'origine)
  INV[idx] = { pickedAt: Date.now(), ...obj };
  enforceTreasureStackCap(INV[idx]);
  return true;
}
function invRemoveAt(i, n) {
  const s = INV[i]; if (!s) return;
  s.qty -= n;
  if (s.qty <= 0) INV[i] = null;
}

// Échelle étendue façon vrai jeu : +1 à +7 sûr, +8 à +15 probabiliste (peut rétrograder, plancher +7),
// puis PRI/DUO/TRI/TET/PEN — à partir de PRI, un échec NE FAIT PLUS JAMAIS rétrograder (juste le matériau perdu)
const ENH_NAMES = ['+0','+1','+2','+3','+4','+5','+6','+7','+8','+9','+10','+11','+12','+13','+14','+15',
  'PRI (I)','DUO (II)','TRI (III)','TET (IV)','PEN (V)'];
const PRI_IDX = 16; // index du premier palier "PRI" — sert de frontière pour la règle anti-rétrogradation
const SAFE_IDX = 8; // à partir de cet index (+8), l'enchantement cesse d'être garanti à 100%
// Ralenti le 2026-07-08 (demande explicite) : +1 à +15 donnaient déjà +96% cumulé à eux seuls
// (0.56 jusqu'à +7, +0.40 jusqu'à +15) — largement suffisant pour franchir la zone suivante sans
// jamais avoir besoin de PRI+, qui perdait tout son intérêt. Les paliers +1→+15 sont divisés par
// ~1.6 (cumul +15 : 0.59 au lieu de 0.96) ; PRI→PEN restent inchangés et représentent maintenant
// plus de la moitié du gain total à PEN (0.74 sur 1.33, contre 0.74 sur 1.70 avant) — atteindre au
// moins PRI devient un vrai palier de progression, pas un bonus optionnel. Les zones ont aussi été
// recalibrées en conséquence (voir reqAP/reqDP des zones 3, 6 et 9 dans ZONES).
// Palier PRI relevé le 2026-07-06 (demande explicite : "en moyenne on doit être en PRI" pour
// passer au palier de couleur suivant) : simulation d'un stuff complet moyen-PRI (scale=1, farmé
// dans la meilleure zone du palier précédent) donnait un ratio PA/PD de seulement 0.58-0.70 face à
// la 1ère zone du palier suivant (zones 3/6/9) — encore sous le seuil de 0.6 qui bascule en ZONE
// DANGEREUSE pour le pire cas (gris→blanc). Plutôt que gonfler GEAR_ROLE (casserait l'équilibre
// déjà bon sur SA PROPRE zone, ratio ~0.9-1.0, en le faisant grimper à "ZONE DÉPASSÉE"), seul le
// palier PRI lui-même est relevé (+0.08 → +0.20) : ne change RIEN pour +0 à +15 (donc aucun impact
// sur l'équilibre intra-zone), et comme enhBonus() est recalculé à la volée depuis enhLv à chaque
// affichage (jamais figé sur l'objet), c'est rétroactif AUTOMATIQUEMENT sur tout le stuff déjà
// équipé/en sac de tous les joueurs, sans script de migration — exactement l'automatisme demandé.
const ENH_STEP = [0, .05,.05,.05,.05,.05,.05,.05,  .03,.03,.03,.03,.03,.03,.03,.03,  .20,.10,.13,.18,.25];
function enhBonus(lvl) { let b = 0; for (let i = 1; i <= (lvl||0); i++) b += ENH_STEP[i]; return b; }
function itemMult(item) { return item && item.optimizable ? (1 + enhBonus(item.enhLv||0)) : 1; }
// PA/PD réels d'un objet une fois son bonus d'enchantement appliqué (affichage tooltip/popup —
// avant ce correctif, ces deux endroits affichaient la stat de BASE même sur un objet enchanté +15)
// PA/PD arrondis vers le BAS (2026-07-08, demande explicite : "laisse uniquement des ajout de PA
// entier, enleve toute trace de virgule de PA/PD... rajoute les plus bas que necessaire pas a la
// hausse") -- Math.floor plutôt que Math.round : ne JAMAIS afficher/accorder plus de PA/PD que ce
// qui est réellement gagné (un Math.round aurait pu arrondir 2.6 à 3, donnant l'illusion d'un
// point de plus que la vraie valeur). L'Esquive reste en % avec décimales (pas concernée, c'est
// une stat de %, pas un PA/PD).
function effectiveApDp(item) {
  const mult = itemMult(item);
  return { ap: Math.floor((item.ap||0) * mult), dp: Math.floor((item.dp||0) * mult), hp: Math.floor((item.hp||0) * mult),
    dodge: Math.round((item.dodge||0) * mult * 100) / 100 };
}
// stats projetées SI l'objet atteignait targetLvl -- sert à afficher le gain avant de lancer
// l'optimisation auto (demande explicite du 2026-07-05 : "il est écrit ce que tu gagnes si tu
// passes à ce palier")
function projectedApDp(item, targetLvl) {
  const mult = 1 + enhBonus(targetLvl);
  return { ap: Math.floor((item.ap||0) * mult), dp: Math.floor((item.dp||0) * mult), hp: Math.floor((item.hp||0) * mult),
    dodge: Math.round((item.dodge||0) * mult * 100) / 100 };
}

// ---------- chances d'optimisation : base FIXE + failstack PERSONNEL À CHAQUE OBJET ----------
// le failstack est attaché à l'objet ET au niveau précis qu'il a raté — jamais perdu, même après un succès ailleurs
const ENH_CHANCE_FLAT = {
  8:.45,  9:.38,  10:.30, 11:.24, 12:.18, 13:.13, 14:.08, 15:.05,   // +8 à +15
  16:.12, 17:.09, 18:.06, 19:.03, 20:.012,                          // PRI..PEN
};
// gain de chance par échec accumulé sur CE niveau précis, pour CET objet précis
const ENH_FS_INC = {
  8:.05,  9:.045, 10:.04, 11:.035, 12:.03, 13:.025, 14:.02, 15:.015,
  16:.015,17:.012,18:.008,19:.004, 20:.0015,
};
function itemFailstack(item, level) { return (item && item.fsByLevel && item.fsByLevel[level]) || 0; }
function addItemFailstack(item, level) {
  if (!item) return;
  if (!item.fsByLevel) item.fsByLevel = {};
  item.fsByLevel[level] = (item.fsByLevel[level] || 0) + 1;
}
// renvoie {base, bonus, total} — base = chance fixe, bonus = apport du failstack (affichés séparément sur la barre)
function enhChanceParts(level, item) {
  if (level < SAFE_IDX) return { base:1, bonus:0, total:1 };
  const base = ENH_CHANCE_FLAT[level] ?? .01;
  const inc = ENH_FS_INC[level] ?? .01;
  const fs = itemFailstack(item, level);
  const bonus = Math.min(0.9 - base, fs * inc); // plafond global 90%
  return { base, bonus: Math.max(0, bonus), total: base + Math.max(0, bonus) };
}
function enhChance(level, item) { return enhChanceParts(level, item).total; }

// ==================== POWER SCORE & SCALING ====================
// les 3 armes (principale + éveil + secondaire) contribuent chacune leur PA, selon LEUR PROPRE enchant
function weaponAP() {
  let a = 0;
  for (const k of WEAPON_SLOTS) { const e = EQUIP[k]; if (e) a += (e.ap||0) * itemMult(e); }
  return a;
}
// armure + bijoux : chaque pièce contribue selon SON propre niveau d'enchant
function equipAP() {
  let a = 0;
  for (const k of [...ARMOR_SLOTS, ...ACC_SLOTS]) { const e = EQUIP[k]; if (e) a += (e.ap||0) * itemMult(e); }
  return a;
}
function equipDP() {
  let d = 0;
  for (const k of [...ARMOR_SLOTS, ...ACC_SLOTS]) { const e = EQUIP[k]; if (e) d += (e.dp||0) * itemMult(e); }
  return d;
}
// PV apportés par l'armure (casque/plastron/gants/bottes) — demande : "ajoute au stuff des PV pour
// que les joueurs ne se fassent pas one-shot". S.hpMax reste la valeur de BASE (progression par
// niveau) ; effHpMax() = base + bonus d'armure, utilisée partout où "les PV max actuels" comptent.
function equipHP() {
  let h = 0;
  for (const k of ARMOR_SLOTS) { const e = EQUIP[k]; if (e) h += (e.hp||0) * itemMult(e); }
  return h;
}
const effHpMax = () => S.hpMax + equipHP();
// mana (2026-07-05, demande explicite) : pas de bonus d'équipement pour l'instant, juste la
// réserve de base -- suit le même patron que effHpMax() pour rester facile à étendre plus tard
const effManaMax = () => S.mpMax;
// Esquive (2026-07-08) : stat de % dropée UNIQUEMENT sur les 4 pièces d'armure (voir GEAR_ROLE),
// enchantée comme AP/DP/PV (itemMult). Chaque point de % réduit la chance de subir un coup.
function equipDodge() {
  let d = 0;
  for (const k of ARMOR_SLOTS) { const e = EQUIP[k]; if (e) d += (e.dodge||0) * itemMult(e); }
  return d;
}
function armorBonusAvg() {
  const pieces = ARMOR_SLOTS.map(k => EQUIP[k]).filter(Boolean);
  if (!pieces.length) return 0;
  return pieces.reduce((s,e) => s + enhBonus(e.enhLv||0), 0) / pieces.length;
}
const apEff = () => (S.pa + weaponAP() + equipAP());
const totalDP = () => S.dp + equipDP();
const GS = () => (apEff() + totalDP()) / 2; // Gearscore affiché au joueur — n'est plus utilisé pour le scaling
const apRatio = (z) => apEff() / (z || Z()).reqAP;
const dpRatio = (z) => totalDP() / (z || Z()).reqDP;
const bottleneck = (z) => Math.min(apRatio(z), dpRatio(z));

// ==================== COMPENDIUM (bonus de collection) ====================
// demande explicite du 2026-07-08 : le bonus d'une zone n'est actif QUE si les 4 objets de cette
// zone (trash/matériau du palier/bijou jackpot/objet craft) ont TOUS déjà été obtenus au moins une
// fois — pas juste "avoir farmé la zone une fois" comme avant. Entièrement CALCULÉ à la volée à
// partir de S.lootByItem (jamais un flag stocké séparément) : donc automatiquement rétroactif, y
// compris pour les objets obtenus dans d'autres zones du même palier (matériau/bijou partagés).
function zoneItemNames(zi) {
  const z = ZONES[zi], tier = gearTierForZone(zi);
  return [tr(z.loot.trash.name), tr(tier.material.name), tr(z.loot.jackpot.name), tr(z.loot.craft.name)];
}
function zoneFullyCollected(zi) { return zoneItemNames(zi).every(n => compendiumItemDone(n)); }
// appelé après chaque ramassage d'objet (voir dropsTick) : détecte le passage "incomplet → complet"
// pour cette zone précise, et affiche la même notif +1% qu'avant (floatTxt + Discord)
function checkZoneCompendiumUnlock(zi, wasDone) {
  if (wasDone || !zoneFullyCollected(zi)) return;
  floatTxt(P.x, P.y, 96, '📖 Compendium — '+tr(ZONES[zi].name), { gold:true });
  const zc = compendiumZoneCount();
  logToDiscord('📖 Compendium', `**${myPseudo||'Joueur'}** débloque le bonus de **${tr(ZONES[zi].name)}** (${zc}/${ZONES.length} zones${zc>=ZONES.length?' — COMPENDIUM COMPLET ✓':''})`, 0xc9a55a);
}
// World Boss (ajouté au Compendium le 2026-07-08, demande explicite) : vaincre un boss AU MOINS
// une fois débloque le même bonus qu'une zone (+1% SPD/DMG/Esquive), voir endBossFight
function markBossDefeated(bossId) {
  if (S.bossesKilled[bossId]) return;
  S.bossesKilled[bossId] = true;
  const b = BOSS_ROSTER[bossId];
  floatTxt(P.x, P.y, 96, '📖 Compendium — '+b.name[LANG], { gold:true });
  logToDiscord('📖 Compendium', `**${myPseudo||'Joueur'}** débloque le bonus de **${b.name.fr}** (World Boss)`, 0xc9a55a);
}
function compendiumZoneCount() { return ZONES.reduce((n,z,zi) => n + (zoneFullyCollected(zi)?1:0), 0); }
function compendiumBossCount() { return Object.keys(S.bossesKilled||{}).length; }
function compendiumTotalCount() { return compendiumZoneCount() + compendiumBossCount(); }
function compendiumTotalMax() { return ZONES.length + Object.keys(BOSS_ROSTER).length; }
function compendiumPct() { return compendiumTotalCount() * 1; } // points de %, 1 par zone OU par boss

// ---- Compendium spécial "Maîtrise PEN" (2026-07-08, demande explicite) : liste TOUS les objets
// optimisables du jeu (7 pièces × 4 paliers de stuff + 1 bijou par zone) et suit lesquels ont déjà
// atteint PEN (niveau max) AU MOINS UNE FOIS — purement un suivi de complétion, sans bonus de
// stats (contrairement au Compendium zones/World Boss). Persisté via S.penMastery.
function penMasteryItemList() {
  const names = [];
  for (const tier of GEAR_TIERS) for (const slot of GEAR_SLOTS) names.push(tier.sets[slot]);
  for (const z of ZONES) names.push(z.loot.jackpot.name);
  return names; // 4×7 + 11 = 39 entrées, dans l'ordre gris→blanc→vert→bleu puis zone 1→11
}
function markPenMastery(name) {
  if (S.penMastery[name]) return;
  S.penMastery[name] = true;
  const done = compendiumPenCount(), max = penMasteryItemList().length;
  floatTxt(P.x, P.y, 96, '🌟 PEN — '+tr(name), { gold:true });
  logToDiscord('🌟 Maîtrise PEN', `**${myPseudo||'Joueur'}** amène ${name} à PEN pour la première fois (${done}/${max}${done>=max?' — MAÎTRISE COMPLÈTE ✓':''})`, 0xffe9a8);
}
function compendiumPenCount() { return Object.keys(S.penMastery||{}).length; }
// meilleur niveau d'optimisation JAMAIS atteint pour un nom d'objet donné (2026-07-15, demande
// explicite : "affiche l'opti dans le compendium si on a vendu un objet optimisé") — contrairement
// à S.penMastery (qui ne retient QUE le passage à PEN), ceci retient TOUT niveau intermédiaire
// (+1 à +19 compris), pour que le Compendium garde une trace même d'un objet enchanté puis vendu
// avant PEN. Mis à jour à CHAQUE succès d'optimisation (voir attemptEnhance), jamais effacé.
function trackEnhPeak(name, lvl) {
  if (!S.enhPeakByName) S.enhPeakByName = {};
  if ((S.enhPeakByName[name]||0) < lvl) S.enhPeakByName[name] = lvl;
}

// Vitesse de déplacement (2026-07-08) : progression par NIVEAU (0% au niv.1, jusqu'à +75% au
// niveau 61, plafonné ensuite) + bonus de Compendium (points de % additifs entre eux).
function levelSpdPct() { return Math.max(0, Math.min(S.lvl,61)-1) / 60 * 75; }
function totalSpdPct() { return levelSpdPct() + compendiumPct(); }
// variantes "pour un niveau HYPOTHÉTIQUE" (2026-07-15, demande explicite : "ce qu'on gagne par
// lvl... des qu'on prend un lvl les info change en fonction") -- réutilisées par l'onglet
// Statistiques > Niveaux pour prévisualiser les 5 niveaux avant/après le niveau actuel, sans
// dépendre de S.lvl. hpMaxFor() suppose la progression FIXE +8 PV/niveau depuis 100 à lvl 1 (voir
// S.hpMax += 8 dans le level-up, aucune autre source ne modifie S.hpMax).
function levelSpdPctFor(lvl) { return Math.max(0, Math.min(lvl,61)-1) / 60 * 75; }
function hpMaxFor(lvl) { return 100 + 8*Math.max(0, lvl-1); }
function totalDmgPct() { return compendiumPct(); } // le DMG ne monte qu'avec le Compendium, pas le niveau

// Esquive : dépend du niveau du monstre RELATIF au joueur (via dpRatio, comme le reste du combat).
// Sous-géré pour la zone (dpRatio < 0.5) → l'esquive perd tout son intérêt (jusqu'à 0% d'effet) ;
// à niveau ou au-dessus (dpRatio >= 1) → pleinement efficace. Dans une zone basse largement
// dépassée, un bon total d'esquive peut donc éviter presque tous les dégâts.
function dodgeEffectiveness(dpR) {
  if (dpR >= 1) return 1;
  return Math.max(0, (dpR - 0.5) / 0.5);
}
function totalDodgePct(dpR) {
  const raw = equipDodge() + compendiumPct();
  return Math.min(60, raw * dodgeEffectiveness(dpR ?? dpRatio())); // plafond 60% pour ne jamais rendre invincible
}

// Notifications/Succes(UI)/Courrier/Compendium/Quetes desormais dans
// progression/notifications-quests.js (extrait le 2026-07-08, reorganisation par dossiers) --
// charge APRES ce fichier, voir index.html.
// SKILLS/MANA_REGEN_PER_SEC/MANA_POTION/cds/buffTimer/teleportCd/evasionCd desormais dans
// classes/sorcier/skills-data.js (extrait le 2026-07-08, reorganisation par dossiers) --
// charge AVANT ce fichier, voir index.html.

// ==================== PROJECTION ISO ====================
function isoX(x, y) { return (x - y); }
function isoY(x, y) { return (x + y) * .5; }
const cam = { x: 0, y: 0 };
function toScreen(x, y, z = 0) {
  return {
    sx: W/2 + isoX(x,y) - isoX(cam.x,cam.y),
    sy: H/2 + 30 + isoY(x,y) - isoY(cam.x,cam.y) - z,
  };
}
// inverse de toScreen (z=0, au niveau du sol) : sert au clic sur le loot au sol
function screenToWorld(sx, sy) {
  const a = sx - W/2 + isoX(cam.x,cam.y);
  const b = 2*(sy - H/2 - 30) + isoY(cam.x,cam.y)*2;
  return { x: (a+b)/2, y: (b-a)/2 };
}

// ==================== JOUEUR ====================
const P = {
  x: 0, y: 0, hp: 100, mp: 100, // mp (2026-07-05) : réserve de mana courante, voir effManaMax()
  state: 'search', stateT: 0,
  castTimer: 0, castingSkill: null, castProgress: 0,
  bob: 0, faceX: 1, orbitDir: 1, orbitAng: 0,
  potCd: 0, manaPotCd: 0, faint: 0, tpFlash: 0, lootTarget: null, lootClusterX: 0, lootClusterY: 0,
  manualTarget: null, manualMoveT: 0,
  dmgBurstAccum: 0, dmgBurstT: 0, // dégâts encaissés dans la fenêtre glissante en cours (voir wolvesTick)
  faintZoneIdx: 0, faintAtVelia: false, // zone au moment du K.O., utilisée par die() (voir wolvesTick)
};
const BASE_SPEED = 92;

// ==================== MONDE ====================
let packs = [], drops = [], particles = [], floats = [], corpses = [];
let packSerial = 0, target = null, shakeT = 0, shakeAmp = 0;

function dist(ax,ay,bx,by){ return Math.hypot(ax-bx,ay-by); }

function spawnPackNear() {
  packSerial++;
  const z = Z();
  // Mine de Fer Abandonnée (zone 6) : 1 pack sur 2 est mené par un boss (contremaître blindé, plus
  // gros, qui loot plus — les multiplicateurs alpha ×1.5/1.6 s'appliquent déjà) — demande explicite
  // du 2026-07-07. Les autres zones gardent le rythme habituel d'1 pack alpha sur 5.
  const alpha = zoneIdx === 6 ? packSerial % 2 === 0 : packSerial % 5 === 0;
  let x, y, tries = 0;
  do {
    const a = Math.random()*Math.PI*2, d = 320 + Math.random()*360;
    x = P.x + Math.cos(a)*d; y = P.y + Math.sin(a)*d; tries++;
  } while (tries < 12 && packs.some(p => !p.dead && dist(x,y,p.x,p.y) < 200));

  // densité progressive : packs de plus en plus grands en avançant dans les zones
  const baseSize = 2 + Math.floor(zoneIdx * 0.5); // Z1→2, Z6→4-5, Z12→7-8
  const n = alpha ? 2 : Math.min(9, baseSize + Math.floor(Math.random()*3));
  const hpPer = z.hpPer * (alpha ? 2.6 : 1);
  const wolves = [];
  for (let i = 0; i < n; i++) {
    const a = (i/n)*Math.PI*2 + Math.random();
    wolves.push({
      ox: Math.cos(a)*(30+Math.random()*22), oy: Math.sin(a)*(30+Math.random()*22),
      gx: Math.cos(a)*10, gy: Math.sin(a)*10,
      scale: alpha ? 1.5 : .85 + Math.random()*.25,
      phase: Math.random()*6.28,
      tone: alpha ? z.alphaTone : z.tones[i % z.tones.length],
      alpha, // les silhouettes par zone peuvent dessiner une variante "boss" (voir drawMineurIso)
      atkT: 1 + Math.random()*2, lunge: 0,
      // PV INDIVIDUEL par monstre (2026-07-11, demande explicite : "chaque monstre a sa propre
      // barre de vie et son loot associé") -- avant, tout le pack partageait une seule barre/PV
      // agrégée et mourait d'un coup ; chaque monstre meurt maintenant un par un, voir currentWolf()/killWolf()
      hp: hpPer, maxHp: hpPer, dead: false,
    });
  }
  packs.push({
    x, y, wolves, alpha,
    aggro:false, gathered:0, dead:false,
    dmg: z.dmg * (alpha ? 1.8 : 1),
  });
}

// nombre de packs actifs simultanément dans le monde -- davantage à partir du palier BLANC
// (2026-07-11, demande explicite : "rajoute des groupe de monstre a partir de la zone blanche" /
// "+ de pack meme monstre") : le monstre et son loot restent ceux de la zone, seul le nombre de
// groupes vivants en même temps dans le monde augmente avec le palier de stuff.
function targetPackCount() {
  if (atVelia) return 0;
  // volontairement SANS passer par GEAR_TIERS/gearTierForZone : resetWorld() (juste en dessous)
  // s'exécute immédiatement au chargement du script, AVANT que GEAR_TIERS (const déclarée bien
  // plus bas dans le fichier) n'existe -- y faire appel ici plantait tout le script au chargement
  // (ReferenceError, confirmé en live). Reprend directement les mêmes groupes de zones par palier
  // que GEAR_TIERS.zones (grey/white/green/blue), sans dépendance d'ordre de déclaration.
  if (zoneIdx===0 || zoneIdx===1 || zoneIdx===2 || zoneIdx===12) return 6;  // grey
  if (zoneIdx===3 || zoneIdx===4 || zoneIdx===5 || zoneIdx===13) return 8;  // white
  // vert = 2x le palier blanc (2026-07-12, demande explicite : "zone verte rajoute 2x le nombre
  // de monstre actuel", précisé "2x la valeur du palier blanc") -- 16 au lieu du +2 progressif
  // utilisé jusqu'ici (10), qui ne doublait rien
  if (zoneIdx===6 || zoneIdx===7 || zoneIdx===8 || zoneIdx===14) return 16; // green
  return 12; // blue : 9,10,11,15
}
// keepPos (2026-07-15, demande explicite : "au reload, apres maj le joueur arrive dans une zone
// vide, fais en sorte qu'il trouve rapidement des monstre") -- BUG trouvé : au chargement d'une
// sauvegarde, applySaveState() restaurait bien P.x/P.y APRÈS resetWorld(), mais resetWorld()
// remettait TOUJOURS P.x/P.y à (0,0) avant de faire spawn les packs autour. Résultat : les packs
// spawnaient près de l'origine pendant que le joueur se téléportait ensuite loin de là -- "zone
// vide" au reload. keepPos=true fait spawn les packs autour de la position ACTUELLE de P (déjà
// restaurée par l'appelant) au lieu de forcer un retour à l'origine.
function resetWorld(keepPos) {
  packs = []; drops = []; corpses = []; particles = []; floats = [];
  target = null; P.lootTarget = null; P.manualTarget = null;
  if (!keepPos) { P.x = 0; P.y = 0; }
  cam.x = P.x; cam.y = P.y; P.lootClusterX = 0; P.lootClusterY = 0;
  P.state = 'search'; P.hp = effHpMax();
  lastLootEntry = null; // évite de fusionner le loot d'une nouvelle zone avec celui d'avant
  if (atVelia) return; // Velia = zone paisible, aucun monstre n'y est jamais généré
  for (let i = 0; i < targetPackCount(); i++) spawnPackNear();
}
resetWorld();
// capture immédiate et synchrone de l'état "personnage neuf" — AVANT toute sauvegarde cloud
// éventuelle (qui se charge de façon asynchrone plus tard) pour ne jamais la contaminer
let DEFAULT_SAVE = JSON.parse(JSON.stringify(getSaveState()));

// ==================== FSM ====================
function hpTier() {
  const p = P.hp / effHpMax();
  if (p > .8) return 'agressif';
  if (p > .5) return 'normal';
  if (p > .25) return 'prudent';
  return 'urgence';
}
function setState(st){ P.state = st; P.stateT = 0; }

// pénalité de vitesse liée au poids retirée (2026-07-15, demande explicite : "enleve ralentit par
// le poids") -- ne reste que le bonus SPD niveau/Compendium et le malus de zone dangereuse
function speedMult() {
  const dangerMult = isZoneDangerous() ? DANGER_PLAYER_SPEED_MULT : 1;
  return (1 + totalSpdPct()/100) * dangerMult;
}
function moveToward(tx, ty, speed, dt) {
  const d = dist(P.x,P.y,tx,ty);
  if (d < 1) return d;
  const vx = (tx-P.x)/d, vy = (ty-P.y)/d;
  const effSpeed = speed * speedMult();
  P.x += vx*effSpeed*dt; P.y += vy*effSpeed*dt;
  P.faceX = isoX(vx,vy) >= 0 ? 1 : -1;
  P.bob += dt*9;
  return d;
}
function doTeleport(dirX, dirY) {
  teleportCd = 4.5;
  const d = Math.hypot(dirX,dirY)||1;
  const nx = P.x + dirX/d*95, ny = P.y + dirY/d*95;
  particles.push({ type:'tpTrail', x1:P.x, y1:P.y, x2:nx, y2:ny, life:.4, max:.4 });
  P.x = nx; P.y = ny; P.tpFlash = 1;
}
// potions de vie : 4 tailles au choix du joueur, prix FIXE différent pour chacune, payées à
// CHAQUE utilisation (vrai sink économique — sans silver, pas de soin, le joueur encaisse).
// Calibrage : le coût au %PV soigné augmente légèrement avec la taille (les grosses potions
// restent un luxe) et le temps de recharge grandit avec le soin apporté, pour qu'aucune taille
// ne soit "abusable" (spam en boucle) ni trop faible pour être utile.
// Recalibré le 2026-07-08 par rapport à la courbe de gains des zones de Velia (~3 000 silver/h en
// zone 1 jusqu'à ~100 000 silver/h en zone 11, voir roadmap.md) : même utilisée en continu à
// son propre CD, la potion la plus chère (mega) ne dépasse jamais ~15% du revenu horaire d'une
// zone adaptée à son coût — un vrai sink sans jamais casser l'économie du joueur qui progresse.
// "Potion de vie" (infinite, cost:0) : verrouillée 🔒 en bas du sélecteur, réservée à un futur
// déblocage (récompense/boutique) — visible dès maintenant pour montrer où elle mènera.
// POTIONS/POTION_ORDER desormais dans combat/potions-data.js (extrait le 2026-07-08,
// reorganisation par dossiers) -- charge AVANT ce fichier, voir index.html.
// potionHourlyIncome/potionCost/usePotion/usePotionMana/renderPotSelect/togglePotSelect
// desormais dans combat/potions-logic.js (extrait le 2026-07-08, reorganisation par dossiers) --
// charge APRES ce fichier, voir index.html.

function fsm(dt) {
  P.stateT += dt;
  if (P.faint > 0) {
    P.faint -= dt;
    if (P.faint <= 0) { die(); }
    return;
  }

  P.potCd = Math.max(0, P.potCd-dt);
  const tier = hpTier();
  // jamais d'auto-soin à Velia (2026-07-09, bug trouvé lors d'une vérification) : Velia est une
  // zone paisible sans aucun monstre, mais fsm() tournait quand même à Velia -- juste après une
  // mort (die() met P.hp à 50% PILE au seuil par défaut), une potion payante partait aussitôt sans
  // aucun combat pour la justifier, gaspillant du silver au pire moment (juste après avoir été tué)
  if (!atVelia && (P.hp/effHpMax()) <= (S.potionThreshold ?? 0.5) && P.potCd <= 0) usePotion();
  // mana (2026-07-05, demande explicite) : régén passive + potion de mana auto-bue sous 30%,
  // même principe que la potion de PV mais seuil fixe (pas de réglage joueur pour l'instant) —
  // la régén passive continue à Velia (sans danger), seul l'ACHAT auto d'une potion est bloqué
  P.mp = Math.min(effManaMax(), P.mp + MANA_REGEN_PER_SEC*dt);
  P.manaPotCd = Math.max(0, P.manaPotCd-dt);
  if (!atVelia && (P.mp/effManaMax()) <= 0.3 && P.manaPotCd <= 0) usePotionMana();
  if (tier==='urgence' && teleportCd <= 0 && target && !target.dead) {
    doTeleport(P.x-target.x, P.y-target.y);
    teleportCd = 0; doTeleport(P.x-target.x, P.y-target.y);
  }

  // déplacement manuel (clic joueur sur du loot au sol) : prioritaire sur l'IA. Tant que le perso
  // n'est pas arrivé, on ne repasse PAS par le switch d'état ci-dessous ("pas de retour" demandé) —
  // l'IA reprend exactement où elle en était (état inchangé) une fois la destination atteinte.
  if (P.manualTarget) {
    const d = moveToward(P.manualTarget.x, P.manualTarget.y, BASE_SPEED*(buffTimer>0?1.25:1), dt);
    if (d < 14) P.manualTarget = null;
    for (const k in cds) cds[k] = Math.max(0, cds[k]-dt);
    buffTimer = Math.max(0,buffTimer-dt);
    teleportCd = Math.max(0,teleportCd-dt);
    evasionCd = Math.max(0,evasionCd-dt);
    P.tpFlash = Math.max(0,P.tpFlash-dt*3);
    return;
  }

  switch (P.state) {
    case 'search': {
      target = packs.filter(p=>!p.dead)
                    .sort((a,b)=>dist(P.x,P.y,a.x,a.y)-dist(P.x,P.y,b.x,b.y))[0]||null;
      if (target) setState('move');
      break;
    }
    case 'move': {
      if (!target || target.dead) { setState('search'); break; }
      const d = moveToward(target.x,target.y,BASE_SPEED*(buffTimer>0?1.25:1),dt);
      if (teleportCd <= 0 && d > 260) doTeleport(target.x-P.x,target.y-P.y);
      if (d <= 170) { target.aggro = true; setState(aiMode()==='overgeared'?'combat':'gather'); }
      break;
    }
    case 'gather': {
      if (!target || target.dead) { setState('search'); break; }
      target.gathered = Math.min(1, target.gathered + dt/1.1);
      P.orbitAng += dt*2.2*P.orbitDir;
      moveToward(target.x+Math.cos(P.orbitAng)*105, target.y+Math.sin(P.orbitAng)*105, BASE_SPEED*.85, dt);
      if (target.gathered >= 1) setState('combat');
      break;
    }
    case 'combat': {
      if (!target || target.dead) { setState(S.farmMode==='xp'?'search':'loot'); break; }
      combatTick(dt);
      break;
    }
    case 'kite': {
      if (!target || target.dead) { setState(S.farmMode==='xp'?'search':'loot'); break; }
      P.orbitAng += dt*1.9*P.orbitDir;
      const r = 125 + Math.sin(P.stateT*3)*14;
      moveToward(target.x+Math.cos(P.orbitAng)*r, target.y+Math.sin(P.orbitAng)*r, BASE_SPEED*.95, dt);
      const danger = target.wolves.filter(w=>!w.dead && w.lunge>0).length >= 2;
      if (danger && teleportCd <= 0) { doTeleport(P.x-target.x,P.y-target.y); P.orbitDir *= -1; }
      if (pickSkill()) setState('combat');
      if (P.stateT > 2.5) setState('combat');
      break;
    }
    case 'loot': {
      P.bob += dt*7;
      // rayon FIXE autour du lieu de mise à mort (pas de la position courante du joueur) : garantit
      // que l'IA "Loot" ramasse VRAIMENT tout le loot du pack avant de repartir, même les drops
      // tombés plus loin que sa position une fois qu'elle a commencé à se déplacer pour looter
      if (!P.lootTarget || P.lootTarget.taken) {
        P.lootStuckT = 0;
        P.lootTarget = drops.filter(l=>!l.taken && !l.skipped && dist(P.lootClusterX,P.lootClusterY,l.x,l.y)<320)
                            .sort((a,b)=>dist(P.x,P.y,a.x,a.y)-dist(P.x,P.y,b.x,b.y))[0]||null;
      }
      if (P.lootTarget) {
        moveToward(P.lootTarget.x,P.lootTarget.y,BASE_SPEED*.9,dt);
        // sac plein : dropsTick() échoue en boucle à ramasser CET objet précis (jamais marqué
        // .taken), le perso restait donc bloqué à le suivre indéfiniment au lieu de continuer à
        // farmer (bug remonté en jeu le 2026-07-06 : "mon perso s'arrête quand il est full, il doit
        // continuer à attaquer comme convenu") -- au bout d'un délai raisonnable, on l'ignore (sans
        // le marquer .taken : il reste au sol, ramassable plus tard si de la place se libère) et on
        // repart chercher le pack suivant, exactement comme prévu à l'origine pour le sac plein.
        P.lootStuckT = (P.lootStuckT||0) + dt;
        if (P.lootStuckT > 1.5) { P.lootTarget.skipped = true; P.lootTarget = null; P.lootStuckT = 0; setState('search'); }
      }
      else setState('search');
      break;
    }
  }

  for (const k in cds) cds[k] = Math.max(0, cds[k]-dt);
  buffTimer = Math.max(0,buffTimer-dt);
  teleportCd = Math.max(0,teleportCd-dt);
  evasionCd = Math.max(0,evasionCd-dt);
  P.tpFlash = Math.max(0,P.tpFlash-dt*3);
}

function pickSkill() {
  const buff = SKILLS.find(s=>s.type==='buff');
  if (buffTimer <= 0 && cds[buff.id] <= 0 && P.mp >= buff.mp) return buff;
  // affordable (2026-07-05, demande explicite) : un sort dont le coût en mana dépasse la réserve
  // actuelle n'est simplement pas proposé -- l'IA retombe sur un sort moins cher, ou aucun (kite)
  const ready = SKILLS.filter(s=>!s.type && cds[s.id]<=0 && P.mp >= s.mp).sort((a,b)=>a.prio-b.prio);
  if (!ready.length) return null;
  const best = ready[0];
  if (best.prio >= 8) {
    const soonBig = SKILLS.filter(s=>!s.type && s.prio<=5).some(s=>cds[s.id]>0 && cds[s.id]<.6);
    if (soonBig) return null;
  }
  return best;
}

function combatTick(dt) {
  const mode = aiMode(), tier = hpTier();
  const wantDist = tier==='agressif' ? 75 : tier==='normal' ? 100 : 130;
  const d = dist(P.x,P.y,target.x,target.y);
  const dx = (P.x-target.x)/(d||1), dy = (P.y-target.y)/(d||1);
  const radial = wantDist - d;
  P.x += dx*radial*dt*2.2; P.y += dy*radial*dt*2.2;
  P.orbitAng = Math.atan2(P.y-target.y,P.x-target.x) + dt*.9*P.orbitDir;
  const nx = target.x + Math.cos(P.orbitAng)*Math.max(d,40);
  const ny = target.y + Math.sin(P.orbitAng)*Math.max(d,40);
  P.x += (nx-P.x)*dt*3; P.y += (ny-P.y)*dt*3;
  P.faceX = isoX(target.x-P.x,target.y-P.y) >= 0 ? 1 : -1;
  P.bob += dt*4;
  if (Math.random() < dt*.15) P.orbitDir *= -1;

  // pas d'esquive automatique en zone dangereuse (2026-07-08, demande explicite : "les monstres...
  // doivent tuer rapidement le joueurs... ONE SHOT") -- sinon ce téléport défensif pouvait sauver
  // le joueur du coup fatal garanti (voir wolvesTick), rendant le risque de la zone contournable
  const incoming = !isZoneDangerous() && target.wolves.some(w=>!w.dead && w.lunge>.25 && w.lunge<.5);
  if (incoming && evasionCd <= 0 && mode !== 'overgeared') {
    evasionCd = 3.2;
    P.x += dx*36; P.y += dy*36; P.tpFlash = .6;
    floatTxt(P.x,P.y,92,'Évasion',{blue:true});
  }

  if (P.castTimer > 0) {
    P.castTimer -= dt;
    P.castProgress = 1 - P.castTimer/(P.castingSkill.castT/S.castMult);
    if (P.castTimer <= 0) resolveSkill(P.castingSkill);
    return;
  }
  const sk = pickSkill();
  if (sk) {
    P.castingSkill = sk;
    P.castTimer = sk.castT/S.castMult;
    P.mp = Math.max(0, P.mp - sk.mp); // coût en mana prélevé au lancer, pas à la résolution
    cds[sk.id] = sk.cd * (mode==='overgeared'?.85:1);
    $('aiSkill').textContent = sk.name;
  } else if (tier !== 'agressif' || mode === 'défensif') setState('kite');
}

// le monstre du pack ACTUELLEMENT visé par le joueur : le premier encore vivant (2026-07-11,
// demande explicite : chaque monstre a désormais son propre PV, on les abat un par un plutôt que
// de vider une seule barre agrégée pour tout le pack d'un coup)
function currentWolf(p) { return p.wolves.find(w => !w.dead) || null; }

function resolveSkill(sk) {
  P.castingSkill = null;
  if (sk.type === 'buff') { buffTimer = sk.dur; floatTxt(P.x,P.y,98,'✦ Speed Spell',{gold:true}); return; }
  if (!target || target.dead) return;
  const aliveWolves = target.wolves.filter(w => !w.dead);
  if (!aliveWolves.length) return; // sécurité : pack déjà vidé (ne devrait pas arriver, target.dead le couvre déjà)
  spawnVfx(sk,target);
  if (sk.shake) { shakeT=.3; shakeAmp=sk.shake; }
  // dégâts de ZONE (2026-07-14, demande explicite : "les attaques de zone visuellement doivent
  // faire des degats de zone sur les monstres") -- les VFX (meteor/ice/quake/bolt...) couvrent déjà
  // toute l'aire du pack (dispersion des particules ~100-110, contre un offset max de ~52 entre
  // monstres d'un même pack, voir spawnPackNear) : avant ce correctif, seul currentWolf() (le 1er
  // monstre vivant) encaissait les dégâts malgré une explosion visuellement étalée sur tout le
  // groupe -- chaque sort touche désormais TOUS les monstres vivants du pack ciblé, chacun avec son
  // propre jet de dégâts/critique indépendant.
  // packs VOISINS qui se chevauchent (2026-07-15, demande explicite : "si plusieurs pack se
  // chevauche... le sort divise ses degats a tout les monstres meme ceux des packs a coté... tu as
  // 4 pack et tu tue qu'un seul pack") -- même seuil de distance que spawnPackNear (200, la distance
  // minimum entre 2 centres de pack) pour désigner 2 packs comme "collés". Confirmé explicitement :
  // le cas à 1 seul pack (pas de voisin collé) garde ses PLEINS dégâts individuels, inchangé -- le
  // partage ne s'applique QUE quand d'autres packs sont réellement dans la même zone d'effet.
  const touchingPacks = packs.filter(p => !p.dead && (p === target || dist(p.x,p.y,target.x,target.y) < 200));
  const allHits = [];
  for (const p of touchingPacks) for (const w of p.wolves) if (!w.dead) allHits.push({ p, w });
  // budget total ancré sur "dégâts pleins pour vider SEULEMENT le pack ciblé" (comme avant) --
  // reparti sur tous les monstres touchés (packs voisins compris) au lieu de se concentrer QUE sur
  // le pack ciblé : plus de packs collés = plus de monstres touchés, mais dégâts individuels plus
  // faibles, pour un total infligé comparable plutôt qu'un multiplicateur par nombre de packs
  const splitFactor = touchingPacks.length > 1 ? aliveWolves.length / allHits.length : 1;
  for (const { p, w } of allHits) {
    const crit = Math.random() < .15;
    // >>> scaling par la PA face à la PA requise de la zone <<<
    const dmg = apEff() * sk.dmg * dmgMult(apRatio()) * (1+totalDmgPct()/100)
              * (0.9+Math.random()*.25) * (crit?2:1) * (buffTimer>0?1.12:1) * splitFactor;
    w.hp -= dmg;
    const wp = wolfPos(p,w);
    floatTxt(wp.x+(Math.random()*36-18), wp.y+(Math.random()*36-18), 62,
      '-'+fmt(Math.ceil(dmg))+(crit?'!':''), {crit});
    if (w.hp <= 0 && !w.dead) killWolf(p, w);
  }
}

// ---------- loups ----------
function wolfPos(p,w){
  return { x:p.x + w.ox*(1-p.gathered) + w.gx*p.gathered,
           y:p.y + w.oy*(1-p.gathered) + w.gy*p.gathered };
}
function wolvesTick(dt) {
  // K.O. (2026-07-09, demande explicite : "quand tu meurs, les monstres ne t'attaquent plus") --
  // sans cette garde, les loups continuaient de charger et de toucher le joueur déjà à 0 PV
  // pendant tout le compte à rebours, ce qui reprolongeait le K.O. (P.faint réinitialisé à 6 à
  // chaque coup) et retirait de l'XP en boucle au lieu d'une seule fois.
  if (P.faint > 0) return;
  // atténuation des dégâts reçus : dépend de TA PD (base + équipement) face à la PD requise de cette zone
  const dpR = dpRatio();
  const mitig = dmgTakenMult(dpR);
  const dangerous = isZoneDangerous();
  // aucune esquive possible en zone dangereuse (2026-07-08, demande explicite : "les monstres...
  // doivent tuer... ONE SHOT dans 100% des cas") -- sinon un résidu de chance d'esquive (dpR entre
  // 0.5 et 0.6, voir dodgeEffectiveness) pouvait sauver le joueur du coup garanti ci-dessous
  const dodgeChance = dangerous ? 0 : totalDodgePct(dpR) / 100; // voir dodgeEffectiveness : quasi nulle si trop sous-géré
  const mobSpeed = 50 * (dangerous ? DANGER_MOB_SPEED_MULT : 1);
  // TOUS les packs proches se réveillent d'un coup, pas seulement celui visé par l'IA (2026-07-08,
  // demande explicite : "les monstres aggros de plus loins... dans 100% des cas" — d'abord limité
  // aux zones dangereuses ; généralisé à TOUTE zone le 2026-07-14, demande explicite : "les monstre
  // aggro lorsque tu es proche d'eux maintenant") -- rend le risque immédiat et évident dès qu'on
  // s'approche, dans n'importe quelle zone, pas juste sur le pack engagé
  for (const p of packs) {
    if (!p.dead && !p.aggro && dist(P.x,P.y,p.x,p.y) <= 400) p.aggro = true;
  }
  for (const p of packs) {
    if (p.dead || !p.aggro) continue;
    const d = dist(P.x,P.y,p.x,p.y);
    // désengagement à distance (demande explicite du 2026-07-06 : "les groupes t'attaquent de plus
    // loin et les autres groupes t'agressent aussi") -- .aggro ne repassait JAMAIS à false une fois
    // activé (voir la FSM, état 'move'), donc chaque pack déjà croisé restait accroché pour
    // toujours, même après que l'IA soit passée à un autre combat : en zone dangereuse (monstres
    // plus rapides, joueur plus lent), ces packs abandonnés finissaient par rattraper le joueur en
    // même temps qu'un autre déjà engagé, créant un effet de meute cumulatif jamais voulu. Passé
    // cette distance, le pack retourne en patrouille (comme s'il n'avait jamais été engagé).
    if (d > 550) { p.aggro = false; continue; }
    if (d > 60) { p.x += (P.x-p.x)/d*mobSpeed*dt; p.y += (P.y-p.y)/d*mobSpeed*dt; }
    for (const w of p.wolves) {
      if (w.dead) continue; // (2026-07-11) un monstre déjà tué individuellement n'attaque plus
      if (w.lunge > 0) {
        w.lunge -= dt;
        if (w.lunge <= 0) {
          const wp = wolfPos(p,w);
          if (dist(P.x,P.y,wp.x,wp.y) < 95) {
            if (Math.random() < dodgeChance) {
              floatTxt(P.x,P.y,80,LANG==='fr'?'Esquivé !':'Dodged!',{blue:true});
            } else {
              const dmgRaw = p.dmg*(0.8+Math.random()*.4)*mitig;
              let dmg;
              if (dangerous) {
                // ZONE DANGEREUSE : dégâts GARANTIS létaux, pas juste "sans plafond" -- demande
                // explicite du 2026-07-08 ("dans 100% des cas... tuer rapidement... ONE SHOT") :
                // le coup brut peut suffire seul, mais Math.max avec effHpMax() garantit la mort
                // même sur un stuff tout juste sous le seuil (dmgRaw parfois insuffisant de peu) —
                // le badge doit représenter un risque de mort certaine, jamais probable seulement.
                dmg = Math.max(dmgRaw, effHpMax());
              } else {
                // en dehors d'une zone dangereuse : garde le plafond à 30% des PV max CUMULÉ sur
                // une fenêtre glissante d'1s (2026-07-06/08) -- plusieurs loups d'un même pack (ou
                // plusieurs packs agressifs à la fois) peuvent chacun toucher au même moment ; sans
                // ce plafond cumulé, plusieurs coups à 30% s'enchaînant en une fraction de seconde
                // équivaudraient à une mort surprise même quand le stuff n'est QUE légèrement sous
                // le seuil (DIFFICILE, pas DANGEREUSE).
                if (performance.now() - P.dmgBurstT > 1000) P.dmgBurstAccum = 0;
                P.dmgBurstT = performance.now();
                const room = Math.max(0, effHpMax()*0.3 - P.dmgBurstAccum);
                dmg = Math.min(dmgRaw, room);
                P.dmgBurstAccum += dmg;
              }
              P.hp -= dmg;
              floatTxt(P.x,P.y,80,'-'+Math.ceil(dmg),{hurt:true});
              if (P.hp <= 0) {
                P.hp = 0; P.faint = 6;
                // zone au moment du K.O. (2026-07-09, demande explicite) : sert à die() pour ne
                // renvoyer à Velia que si le joueur n'a pas déjà changé de zone pendant le KO
                P.faintZoneIdx = zoneIdx; P.faintAtVelia = atVelia;
                floatTxt(P.x,P.y,105,'K.O.',{hurt:true});
                S.xp = Math.max(0, S.xp - S.xpNext*.01); // -1 % XP
              }
            }
          }
        }
      } else {
        w.atkT -= dt;
        if (w.atkT <= 0) {
          // attaque bien plus rapide en zone dangereuse (2026-07-08, demande explicite : "doivent
          // tuer rapidement le joueur") -- le loup n'attend presque plus entre deux coups et lance
          // sa charge quasi instantanément, au lieu du rythme normal de patrouille
          w.atkT = dangerous ? 0.4+Math.random()*.3 : 2.6+Math.random()*2;
          w.lunge = dangerous ? 0.15 : 0.55;
        }
      }
    }
  }
}

// ---------- mort de monstre (individuel) & de pack (une fois tous ses monstres tués) ----------
// (2026-07-11, demande explicite : "chaque monstre a sa propre barre de vie et son loot associé")
// -- avant, killPack tuait tout le pack et tirait le loot de chaque loup EN UNE FOIS quand la barre
// agrégée du pack tombait à 0 ; désormais chaque monstre meurt et loot individuellement dès que SON
// PROPRE PV atteint 0 (voir currentWolf/resolveSkill), et killPack ne fait plus que la finalisation
// une fois le DERNIER monstre du pack tombé.
function killWolf(p, w) {
  w.dead = true;
  const z = Z(), lm = lootMult(bottleneck());
  const killsBefore = S.kills;
  S.kills++;
  // palier de kills "pour le fun" (demande explicite du 2026-07-08)
  if (Math.floor(S.kills/1000) > Math.floor(killsBefore/1000)) {
    logToDiscord('💀 Palier de kills', `**${myPseudo||'Joueur'}** vient d'atteindre **${fmt(Math.floor(S.kills/1000)*1000)}** monstres tués à vie`, 0x7a2d33);
  }
  gainXp(z.xp * (p.alpha?3:1));
  const wp = wolfPos(p,w);
  corpses.push({ x:wp.x, y:wp.y, scale:w.scale, tone:w.tone, life:2.4 });
  rollDrops(wp, p.alpha, lm);
  hud();
  if (p.wolves.every(ww => ww.dead)) killPack(p);
}
function killPack(p) {
  p.dead = true;
  $('aiSkill').textContent = '—';
  P.lootTarget = null;
  if (S.farmMode === 'xp') {
    setState('search'); // mode XP : ignore le loot au sol, enchaîne directement vers le pack suivant
  } else {
    P.lootClusterX = p.x; P.lootClusterY = p.y; // centre de la zone de loot à nettoyer avant de repartir
    setState('loot');
  }
  hud();
}

// GEAR_TIERS/GEAR_CHANCE/LOOT_RATES_V2/GEAR_SLOTS/ZONE_WEAPON_SLOTS/ZONE_ARMOR_SLOTS/GEAR_ROLE/
// HP_GEAR_SCALE/DODGE_GEAR_SCALE (+ gearTierForZone/gearDropChance/jewelDropChance/gearFloor)
// desormais dans world/gear-tiers-data.js (extrait le 2026-07-08, reorganisation par dossiers) --
// charge AVANT ce fichier, voir index.html.
// GEAR_SELL_MULT/JACKPOT_VAL_TRASH_RATIO/ALPHA_LOOT_CHANCE_MULT/rollGearDrop/rollWeaponDrop/
// rollDrops/dropsTick/accSlotFor/lootLine/xpNeededFor/fmtXpPct/flashXpGain/gainXp/floatTxt
// desormais dans combat/loot-rolls.js (extrait le 2026-07-08, reorganisation par dossiers) --
// charge APRES ce fichier, voir index.html.

// spawnVfx/particlesTick desormais dans combat/vfx.js (extrait le 2026-07-08, reorganisation
// par dossiers) -- charge APRES ce fichier, voir index.html.

// Rendu canvas (scene, sprites, particules) + demarrage du jeu -> voir render.js (charge APRES ce fichier, voir index.html)
// ==================== HUD ====================
function fmt(n){ n=Math.floor(n); return n>=1e6 ? (n/1e6).toFixed(1)+'M' : n>=1e3 ? (n/1e3).toFixed(1)+'k' : n; }
const STATE_FR = { search:'SearchPack', move:'MoveToPack', gather:'GatherPack', combat:'Combat', kite:'Kite', loot:'Loot' };

const skillBar = $('skillBar');
const skEls = {};
for (const s of SKILLS) {
  const el = document.createElement('div');
  el.className = 'sk';
  el.innerHTML = `<div class="ic">${s.ic}</div><div class="nm">${s.name.split(' ')[0]}</div><div class="cd"></div>`;
  el.title = s.name;
  skillBar.appendChild(el);
  skEls[s.id] = el;
}

// liste des zones
// une seule ligne par zone : cliquer la ligne = partir farmer cette zone (l'ancien bouton
// "Farmer" a été retiré), le bouton 👁 en bout de ligne prévisualise juste le loot sans y aller.
// Le halo doré sur le 👁 marque la zone actuellement PRÉVISUALISÉE (voir lootPreviewIdx) — utile
// pour ne pas confondre la zone dont on regarde le loot avec celle qu'on est en train de farmer.
let lootPreviewIdx = null; // null = suit la zone qu'on farm ; sinon index de la zone prévisualisée via 👁
// paliers de zones : pour l'instant tout ZONES[] est "Early" (jusqu'au niveau ~31) — Mid et End
// arriveront dans une future mise à jour, d'où le verrou 🔒 (demande explicite du 2026-07-05)
let zoneTier = 'early';
// 5 paliers de régions (voir roadmap.md pour le détail des zones prévues par palier) —
// seul "Early / Velia" est en jeu pour l'instant, les autres sont verrouillés en attendant
// d'être construits (demande explicite du 2026-07-05)
// TIER_PREVIEW_CARD/ZONE_TIERS desormais dans world/region-tiers-data.js (extrait le
// 2026-07-08, reorganisation par dossiers) -- charge AVANT ce fichier, voir index.html.
// onglets de la carte Statistiques : "Perso" (contenu existant, inchangé) / "Recommandations"
// (2026-07-09, demande explicite) -- les valeurs de recommandation sont purement THÉORIQUES (voir
// zoneSilverPerHour/zoneXpPerHour/zoneKillsPerMin), donc constantes tout le long d'une session :
// rendu une seule fois au clic sur l'onglet plutôt qu'à chaque tick de hud().
let statsTab = 'perso';
function renderStatsTabs() {
  const el = $('statsTabTabs'); if (!el) return;
  el.querySelectorAll('.catTab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === statsTab));
  const personaPane = $('statsPersoPane'), recoPane = $('statsRecoPane'), levelsPane = $('statsLevelsPane');
  if (personaPane) personaPane.style.display = statsTab === 'perso' ? '' : 'none';
  if (recoPane) recoPane.style.display = statsTab === 'reco' ? '' : 'none';
  if (levelsPane) levelsPane.style.display = statsTab === 'levels' ? '' : 'none';
  if (statsTab === 'reco' && recoPane && !recoPane.dataset.rendered) { renderStatsRecoPane(); recoPane.dataset.rendered = '1'; }
  // pas de garde "déjà rendu" ici (contrairement à Reco) : demande explicite "des qu'on prend un
  // lvl les info change en fonction" -- doit toujours refléter le niveau ACTUEL au moment de l'affichage
  if (statsTab === 'levels') renderStatsLevelsPane();
}
(function wireStatsTabTabs() {
  const el = $('statsTabTabs'); if (!el) return;
  el.querySelectorAll('.catTab').forEach(btn => {
    btn.onclick = () => { statsTab = btn.dataset.tab; renderStatsTabs(); };
  });
})();
// contenu de l'onglet "Recommandations" : meilleure zone pour le silver/h, le xp/h et les
// kills/min, chacun cliquable pour s'y rendre directement (même geste que les zones de farm)
function renderStatsRecoPane() {
  const el = $('statsRecoPane'); if (!el) return;
  const rows = [
    { label: LANG==='fr'?'💰 Meilleur silver/h':'💰 Best silver/h', best: bestZoneForMetric(zoneSilverPerHour), fmtV: v => fmt(Math.round(v))+'/h' },
    { label: LANG==='fr'?'⭐ Meilleur XP/h':'⭐ Best XP/h', best: bestZoneForMetric(zoneXpPerHour), fmtV: v => fmt(Math.round(v))+'/h' },
    { label: LANG==='fr'?'⚔️ Meilleurs kills/min':'⚔️ Best kills/min', best: bestZoneForMetric(zoneKillsPerMin), fmtV: v => v.toFixed(1)+'/min' },
  ];
  el.innerHTML = `<div class="constructionBanner">${LANG==='fr'
      ? '🚧 En construction — calculs et présentation encore amenés à changer'
      : '🚧 Under construction — calculations and presentation still subject to change'}</div>` +
    `<div class="admHint">${LANG==='fr'
      ? 'Classement théorique (stuff idéal, indépendant de ta survie actuelle) — clique une zone pour t\'y rendre.'
      : 'Theoretical ranking (ideal gear, independent of your current survival) — click a zone to go there.'}</div>` +
    rows.map((r,ri) => `<div class="row statsRecoRow" data-zi="${r.best.i}" data-ri="${ri}">` +
      `<span>${r.label}</span><span class="v">${tr(ZONES[r.best.i].name)} · ${r.fmtV(r.best.v)}</span></div>`).join('');
  el.querySelectorAll('.statsRecoRow').forEach(row => {
    row.onclick = () => { const zi = parseInt(row.dataset.zi,10); if (atVelia || zi !== zoneIdx) travelTo(zi); };
  });
}
// onglet "Niveaux" de la carte Statistiques (2026-07-15, demande explicite : "ce qu'on gagne par
// lvl (5 avant 5 apres et celui + le notre) en stats, des qu'on prend un lvl les info change en
// fonction") -- 5 niveaux avant/après le niveau ACTUEL, ligne du niveau courant mise en évidence.
// PAS de garde "déjà rendu" (contrairement à renderStatsRecoPane) : appelée à chaque affichage de
// l'onglet ET après un level-up (voir le bloc S.lvl++ un peu plus haut) pour toujours refléter le
// niveau courant, comme demandé explicitement.
function renderStatsLevelsPane() {
  const el = $('statsLevelsPane'); if (!el) return;
  const cur = S.lvl, maxLvl = LEVEL_XP_TABLE.length - 1;
  const from = Math.max(1, cur - 5), to = Math.min(maxLvl, cur + 5);
  let rows = '';
  for (let lvl = from; lvl <= to; lvl++) {
    const isCur = lvl === cur;
    rows += `<div class="row statsLevelRow${isCur?' current':''}">` +
      `<span>${LANG==='fr'?'Niv.':'Lvl'} ${lvl}${isCur?(LANG==='fr'?' — toi':' — you'):''}</span>` +
      `<span class="v">${LANG==='fr'?'PV':'HP'} ${fmt(hpMaxFor(lvl))} · SPD +${Math.round(levelSpdPctFor(lvl))}% · XP ${fmt(xpNeededFor(lvl))}</span></div>`;
  }
  el.innerHTML = `<div class="admHint">${LANG==='fr'
    ? '5 niveaux avant et après le tien — PV de base (hors équipement), bonus de Vitesse et XP requise pour CE niveau.'
    : '5 levels before and after yours — base HP (gear excluded), Speed bonus, and XP required for THAT level.'}</div>` + rows;
}
function renderZoneTierTabs() {
  const el = $('zoneTierTabs'); if (!el) return;
  // cadenas déplacé AU-DESSUS, centré (2026-07-12, demande explicite : "réorganise les noms de
  // zone... pour qu'elle prenne qu'une seule ligne si possible en mettant le cadenas au dessus au
  // milieu de chaque item") -- avant, "🔒 🔵 Calpheon" tout sur la même ligne dans le texte du
  // bouton faisait déborder/passer à la ligne certains des 5 onglets ; le cadenas est maintenant un
  // badge séparé au-dessus (.zoneTierLock), le texte du bouton se limite à "🔵 Calpheon", plus court.
  // le libellé vit dans un <span> interne à sa propre troncature (overflow/ellipsis) -- le
  // <button> lui-même reste overflow:visible pour que le badge cadenas (position absolute, dépasse
  // au-dessus) ne soit jamais rogné par la troncature du texte.
  el.innerHTML = ZONE_TIERS.map(t => {
    const card = TIER_PREVIEW_CARD[t.id];
    const lockedTitle = card
      ? (LANG==='fr' ? `Bientôt disponible — droppera : ${card.icon} ${tr(card.name)}` : `Coming soon — will drop: ${card.icon} ${tr(card.name)}`)
      : (LANG==='fr' ? 'Bientôt disponible' : 'Coming soon');
    return `<button class="catTab${t.id===zoneTier?' active':''}${t.locked?' locked':''}"` +
    `${t.locked?' disabled title="'+lockedTitle+'"':''} data-tier="${t.id}">` +
    `${t.locked?'<span class="zoneTierLock">🔒</span>':''}<span class="zoneTierLabel">${t.icon} ${t.label[LANG]}</span></button>`;
  }).join('');
  el.querySelectorAll('.catTab:not(.locked)').forEach(btn => {
    btn.onclick = () => { zoneTier = btn.dataset.tier; buildZoneList(); };
  });
}
function buildZoneList() {
  renderZoneTierTabs();
  const list = $('zoneList');
  list.innerHTML = '';
  // Velia, la ville paisible : épinglée en haut, aucun monstre, aucun farm — juste un accès
  // rapide pour revoir le tutoriel de bienvenue à tout moment
  const veliaRow = document.createElement('div');
  veliaRow.className = 'zRow veliaRow' + (atVelia ? ' current' : '');
  veliaRow.title = LANG==='fr' ? 'Velia — zone paisible' : 'Velia — peaceful zone';
  veliaRow.innerHTML =
    `<span class="zname">🏘️ Velia</span>` +
    `<span class="zBadge">${LANG==='fr'?'ZONE PAISIBLE':'PEACEFUL ZONE'}</span>` +
    `<span class="zreq" style="width:auto">${LANG==='fr'?'Aucun monstre':'No monsters'}</span>`;
  veliaRow.onclick = () => { if (!atVelia) goToVelia(); };
  list.appendChild(veliaRow);
  // zones regroupées par palier de stuff (armure + bijou) — demande explicite du 2026-07-06 :
  // un en-tête coloré (pastille = couleur du palier) sépare les groupes de zones au lieu d'une
  // liste plate, pour bien voir quel stuff on farm dans quelle zone.
  // Parcourt GEAR_TIERS.zones (ordre LOGIQUE des paliers) plutôt que ZONES dans son ordre PHYSIQUE
  // (2026-07-05, bug corrigé) : les 4e zones de chaque palier ont été ajoutées en FIN de tableau
  // (voir ZONES) pour ne jamais décaler les index existants — les parcourir dans l'ordre physique
  // dédoublait les en-têtes de palier (grey/white/green/blue une 2e fois pour ces 4 zones-là).
  // zones offrant vraiment un meilleur socle (2026-07-09, demande explicite) — calculé UNE fois
  // avant la boucle, pas par ligne (chaque appel parcourt tous les slots équipables)
  const upgradeZones = zonesOfferingUpgrade();
  GEAR_TIERS.forEach(tier => {
    const head = document.createElement('div');
    head.className = 'zTierHead';
    head.innerHTML = `<span class="zTierDot" style="background:${tier.color}"></span>${tier.label[LANG]}`;
    list.appendChild(head);
    tier.zones.forEach(i => {
      const z = ZONES[i];
      const b = badgeOf(bottleneck(z));
      const apOk = apRatio(z) >= 1, dpOk = dpRatio(z) >= 1;
      const previewed = lootPreviewIdx==null ? i===zoneIdx : i===lootPreviewIdx;
      const row = document.createElement('div');
      const isCurrent = !atVelia && i===zoneIdx;
      row.className = 'zRow' + (isCurrent?' current':'');
      row.dataset.zi = i; // affichées dans l'ordre des PALIERS, pas l'ordre physique de ZONES — voir updateZoneViewHalo
      row.title = tr(z.name);
      if (!isCurrent) row.style.borderLeftColor = tier.color;
      // nombre de joueurs actuellement dans cette zone (demande explicite du 2026-07-06) — voir
      // zonePlayerCounts/refreshZonePlayerCounts (game-supabase.js), alimenté par le heartbeat de
      // présence toutes les 20s ; masqué (pas de case vide) tant que personne n'y est
      const pCount = (typeof zonePlayerCounts !== 'undefined' && zonePlayerCounts[i]) || 0;
      const hasUpgrade = upgradeZones.has(i);
      // étiquette "admin ici" (2026-07-15, demande explicite : "ajoute a coté des joueurs sur zone
      // une petite etiquette avec écris admin ici") -- visible par TOUS les joueurs depuis le
      // 2026-07-16 (demande explicite : "ettiquette admin montré a tout le monde") : avant, purement
      // client-side (isAdmin() + isCurrent), ne pouvait s'afficher que sur le propre client de
      // l'admin. adminZoneIdx (game-supabase.js, alimenté par get_admin_zone() côté serveur, voir sa
      // migration) renvoie l'index de zone où se trouve le SEUL compte admin, sans exposer
      // l'identité d'aucun autre joueur — même principe de minimisation que zonePlayerCounts.
      const adminHereTag = (typeof adminZoneIdx !== 'undefined' && adminZoneIdx === i)
        ? `<span class="zAdminTag" title="${LANG==='fr'?'Un admin est ici':'An admin is here'}">ADMIN</span>` : '';
      row.innerHTML =
        `<span class="zname">${tr(z.name)}</span>` +
        `<span class="zBadge ${b.cls}">${tr(b.txt.replace('ZONE ',''))}</span>` +
        `<span class="zreq"><span class="${apOk?'ok':'bad'}">${z.reqAP} PA</span> · <span class="${dpOk?'ok':'bad'}">${z.reqDP} PD</span></span>` +
        `<span class="zUpgradeIcon"${hasUpgrade?'':' style="visibility:hidden"'} title="${LANG==='fr'?'Meilleur stuff à trouver ici':'Better gear to find here'}">⬆️</span>` +
        // étiquette ADMIN désormais ancrée au-dessus du compteur de joueurs spécifiquement (2026-07-16,
        // demande explicite : "met le admin absolu au dessus du nombre des joueurs sur la zone") --
        // avant, positionnée en absolu par rapport à TOUTE la ligne (top-right), elle atterrissait
        // au-dessus du bouton 👁 (largeur variable des autres éléments avant elle) plutôt qu'au-dessus
        // du nombre lui-même ; sibling de zPlayerCount dans un wrapper dédié, jamais couplée à sa
        // visibilité (reste visible même si pCount vaut encore 0 au moment du rendu)
        `<span class="zPlayerCountWrap">${adminHereTag}<span class="zPlayerCount"${pCount?'':' style="visibility:hidden"'} title="${LANG==='fr'?'Joueurs actuellement sur cette zone':'Players currently on this zone'}">👥 ${pCount}</span></span>` +
        `<button class="zBtnView${previewed?' active':''}" title="${LANG==='fr'?'Voir le loot':'View loot'}">👁</button>`;
      row.querySelector('.zBtnView').onclick = e => { e.stopPropagation(); renderLootTable(i); };
      row.onclick = () => { if (atVelia || i !== zoneIdx) travelTo(i); };
      // survol d'une zone -> surligne UNIQUEMENT les cases de la poupée que CETTE zone améliore
      // (2026-07-12, demande explicite) -- lien inverse du halo existant "case vide -> zones"
      row.onmouseenter = () => highlightEquipSlotsForZone(slotsUpgradedByZone(i));
      row.onmouseleave = () => highlightEquipSlotsForZone([]);
      list.appendChild(row);
    });
  });
}
// rafraîchit juste les compteurs "👥 N joueurs" (appelé toutes les 20s par refreshZonePlayerCounts,
// game-supabase.js), sans reconstruire toute la liste — même logique dataset.zi que le halo du 👁
function updateZonePlayerCountBadges() {
  document.querySelectorAll('#zoneList .zRow:not(.veliaRow)').forEach(row => {
    const i = parseInt(row.dataset.zi, 10);
    const el = row.querySelector('.zPlayerCount'); if (!el) return;
    const n = (zonePlayerCounts && zonePlayerCounts[i]) || 0;
    el.textContent = `👥 ${n}`;
    el.style.visibility = n ? '' : 'hidden';
  });
}
// rafraîchit juste le halo du 👁 sans reconstruire toute la liste (appelé à chaque aperçu de loot)
function updateZoneViewHalo() {
  // se base sur data-zi (index réel de la zone), pas la position dans le DOM -- depuis que les
  // zones sont affichées groupées par PALIER (voir buildZoneList), l'ordre d'affichage ne
  // correspond plus à l'ordre physique 0..N de ZONES (2026-07-05, bug corrigé)
  document.querySelectorAll('#zoneList .zRow:not(.veliaRow)').forEach(row => {
    const i = parseInt(row.dataset.zi, 10);
    const previewed = lootPreviewIdx==null ? i===zoneIdx : i===lootPreviewIdx;
    row.querySelector('.zBtnView').classList.toggle('active', previewed);
  });
}
// nom + palier affichés en haut du cadre de jeu (#ztName/#ztTier) -- SEUL endroit qui les met à
// jour (2026-07-11, bug corrigé : "le nom de la zone doit être mis à jour et rester en place") :
// avant, seuls travelTo()/goToVelia() les modifiaient, jamais applySaveState() -- après un
// rechargement de page sur une zone différente de la zone 0, le nom affiché restait bloqué sur le
// texte statique du HTML ("Camp des Loups") tant que le joueur ne voyageait pas manuellement.
function updateZoneTitleText() {
  if (atVelia) {
    $('ztName').textContent = LANG==='fr' ? 'Velia' : 'Velia';
    $('ztTier').textContent = LANG==='fr' ? 'Zone paisible' : 'Peaceful zone';
  } else {
    $('ztName').textContent = tr(Z().name);
    $('ztTier').textContent = Z().tier;
  }
}
function travelTo(i) {
  atVelia = false;
  // quitter Velia : efface la liste de joueurs éventuellement affichée dans #lootTicker (2026-07-16)
  // -- sinon elle reste figée par-dessus le loot normal, qui s'ajoute juste après par appendChild
  // (voir lootLine()) sans jamais vider le conteneur lui-même.
  const lt = $('lootTicker'); if (lt) lt.innerHTML = '';
  // "pour le fun" (demande du 2026-07-08) : log Discord la 1ère fois qu'une zone est atteinte
  if (i > S.maxZoneIdx) logToDiscord('🗺️ Nouvelle zone', `**${myPseudo||'Joueur'}** atteint **${tr(ZONES[i].name)}** (${ZONES[i].tier}) pour la première fois`, 0x8fc98a);
  zoneIdx = i;
  if (i > S.maxZoneIdx) S.maxZoneIdx = i;
  S.travelCount = (S.travelCount||0) + 1;
  resetWorld();
  updateZoneTitleText();
  lootPreviewIdx = null; // farmer une nouvelle zone fait à nouveau suivre son loot par défaut
  renderLootTable();
  hud();
  buildZoneList();
  // "l'icône d'upgrade doit revenir sur le stuff... si elle est quittée" (2026-07-12, bug corrigé) :
  // renderEquipment() (badges ⬆️ pdUpgradeBtn de la poupée) n'était jusqu'ici rafraîchi QUE par
  // hud() quand la COMPOSITION du sac change (voir invSignature) -- upgradeZonesForEquippedSlot()
  // dépend pourtant de zoneIdx (une zone quittée redevient une source d'upgrade valide, voir son
  // filtre "atVelia || zi !== zoneIdx"), donc changer de zone SEULE ne rafraîchissait jamais la
  // poupée, qui restait figée sur l'état de la zone précédente jusqu'au prochain loot/vente.
  renderEquipment();
}
// liste des joueurs en ville, affichée dans #lootTicker à la place du loot normal (2026-07-16,
// demande explicite : "on peut voir la liste des joueurs dans la ville a droite a la place du loot
// ticker") -- aucun monstre à Velia donc le ticker de loot y est de toute façon toujours vide
// (lootLine() n'est jamais appelé sans pack), cette zone de l'écran est donc libre à réutiliser.
function updateVeliaPlayersTicker() {
  const t = $('lootTicker'); if (!t || !atVelia) return;
  const label = LANG==='fr' ? `👥 En ville (${veliaPlayers.length})` : `👥 In town (${veliaPlayers.length})`;
  const rows = veliaPlayers.map(p => `<div class="veliaPlayerRow">${p.is_guest?'🎭':'👤'} ${escapeHtml(p.pseudo)}</div>`).join('');
  t.innerHTML = `<div class="veliaPlayersHead">${label}</div>` +
    (rows || `<div class="admHint">${LANG==='fr'?"Personne d'autre pour l'instant":'Nobody else right now'}</div>`);
}
// Velia : zone paisible, aucun monstre — ne lance plus le tutoriel automatiquement (voir
// demande du 2026-07-04), juste un endroit calme où se rendre (à la main ou après une mort)
function goToVelia() {
  atVelia = true;
  resetWorld();
  updateZoneTitleText();
  lootPreviewIdx = null;
  renderLootTable();
  hud();
  buildZoneList();
  renderEquipment(); // voir le commentaire équivalent dans travelTo()
  // affichage immédiat (état vide le temps que le serveur réponde), sans attendre le prochain tick
  // de refreshVeliaPlayers (20s, voir game-supabase.js)
  updateVeliaPlayersTicker();
  if (typeof refreshVeliaPlayers === 'function') refreshVeliaPlayers();
}
// mort au combat (PV à 0) : renvoie à Velia (zone paisible) avec un message d'avertissement —
// demande explicite du 2026-07-05, remplace l'ancien "faint" qui soignait sur place. Ne renvoie
// PLUS de force vers Velia si le joueur a déjà changé de zone pendant le K.O. (2026-07-09, demande
// explicite : "à la fin du timer tu es renvoyé en ville SI tu n'as pas changé de zone entre temps")
function die() {
  const stayedPut = (zoneIdx === P.faintZoneIdx) && (atVelia === P.faintAtVelia);
  if (stayedPut) goToVelia();
  P.hp = effHpMax()*.5;
  S.lastDeathAt = Date.now(); // sert au bonus de zone des World Boss ("certifié sans mort 3 min", voir endBossFight)
  const banner = $('deathBanner');
  if (banner) {
    banner.textContent = stayedPut
      ? (LANG==='fr'
        ? '⚠ Les monstres t\'ont tué ! Choisis une zone plus adaptée à ton niveau ou améliore ton stuff.'
        : '⚠ The monsters killed you! Pick a zone better suited to your level or improve your gear.')
      : (LANG==='fr'
        ? '⚠ Tu t\'es relevé — tu as changé de zone pendant le K.O.'
        : '⚠ You got back up — you changed zone during the K.O.');
    banner.classList.add('show');
    clearTimeout(die._t);
    die._t = setTimeout(() => banner.classList.remove('show'), 6000);
  }
}

// mise à jour légère des chiffres uniquement (aucune reconstruction de DOM lourde) —
// utilisée pour les actions fréquentes comme les tentatives d'optimisation
function refreshStatsOnly() {
  const invFullEl = $('invFullBanner');
  if (invFullEl) invFullEl.classList.toggle('show', invUsed() >= INV_SIZE);
  const dangerEl = $('dangerBanner');
  if (dangerEl) dangerEl.classList.toggle('show', !atVelia && isZoneDangerous());
  const apR = apRatio(), dpR = dpRatio(), z = Z();
  $('silver').textContent = fmt(S.silver);
  $('invLvl').textContent = S.lvl;
  $('invXpPct').textContent = fmtXpPct(S.xp / S.xpNext * 100);
  // niveau/XP fusionnés sur la même ligne que PA/PD/GS de l'équipement (demande explicite du
  // 2026-07-06) — mêmes valeurs que le HUD au-dessus de la vie, juste un 2e affichage
  const eqSumLvlEl = $('eqSumLvl'), eqSumXpEl = $('eqSumXp');
  if (eqSumLvlEl) eqSumLvlEl.textContent = (LANG==='fr'?'Niv. ':'Lvl ') + S.lvl;
  if (eqSumXpEl) eqSumXpEl.textContent = fmtXpPct(S.xp / S.xpNext * 100);
  $('stPS').textContent = Math.round(GS());
  // PA/PD affichés en entier, arrondis vers le bas (2026-07-08, demande explicite : "enleve toute
  // trace de virgule de PA/PD" -- ne jamais afficher plus que ce qui est réellement acquis)
  $('stPA').textContent = Math.floor(apEff());
  $('stDP').textContent = Math.floor(totalDP());
  $('stHpMax').textContent = fmt(Math.round(effHpMax()));
  $('stMpMax').textContent = fmt(Math.round(effManaMax()));
  $('stSpd').textContent = '+' + Math.round(totalSpdPct()) + '%';
  $('stDodge').textContent = Math.round(totalDodgePct(dpR)*10)/10 + '%';
  // affiche l'état du Compendium directement dans la zone de farm — demande explicite du 2026-07-08
  const ztComp = $('ztCompendium');
  if (ztComp) {
    const zc = compendiumZoneCount(), complete = zc >= ZONES.length;
    ztComp.textContent = (complete ? '📖✓ ' : '📖 ') + zc + '/' + ZONES.length;
    ztComp.className = complete ? 'complete' : '';
  }
  const apEl = $('stApZone');
  const dpEl = $('stDpZone');
  if (atVelia) {
    apEl.textContent = LANG==='fr' ? '—' : '—'; apEl.className = 'v';
    dpEl.textContent = '—'; dpEl.className = 'v';
  } else {
    apEl.textContent = Math.floor(apEff()) + ' / ' + z.reqAP;
    apEl.className = 'v ' + (apR >= 1 ? 'ok' : 'bad');
    dpEl.textContent = Math.floor(totalDP()) + ' / ' + z.reqDP;
    dpEl.className = 'v ' + (dpR >= 1 ? 'ok' : 'bad');
  }
  $('stMode').textContent = tr(aiMode());
  $('stKills').textContent = S.kills;
  $('stLoot').textContent = S.lootCount;
  const mins = (performance.now()-S.startTime)/60000;
  const kpmNow = mins>.1 ? (S.kills-(S.killsAtLoad||0))/mins : 0;
  $('stKpm').textContent = mins>.1 ? kpmNow.toFixed(1) : '—';
  // record kills/min : on exige au moins 2 min de session pour éviter qu'un petit échantillon
  // bruité (ex: 3 kills en 5 secondes juste après un chargement) ne fausse le record à vie —
  // même précaution que le faux positif silver_per_hour corrigé le 2026-07-06
  if (mins > 2 && kpmNow > (S.bestKpm||0)) {
    // "pour le fun" (demande du 2026-07-08) : seuil de +0.5 kills/min pour ne pas spammer sur du bruit
    if (kpmNow - (S.bestKpm||0) > 0.5) logToDiscord('🏹 Record kills/min', `**${myPseudo||'Joueur'}** bat son record perso : **${kpmNow.toFixed(1)}** kills/min (${tr(Z().name)})`, 0xc9a55a);
    S.bestKpm = kpmNow;
  }
  $('shRate').textContent = mins>.1 ? fmt((S.tokenSilverEarned-(S.tokenSilverEarnedAtLoad||0))/(mins/60))+' silver/h' : '— silver/h';
  const zb = $('zoneBadge');
  if (atVelia) {
    zb.className = 'b-green'; zb.textContent = LANG==='fr'?'ZONE PAISIBLE':'PEACEFUL ZONE';
    $('ztReq').textContent = LANG==='fr' ? 'Aucun monstre' : 'No monsters';
  } else {
    const b = badgeOf(bottleneck());
    zb.className = b.cls; zb.textContent = tr(b.txt);
    // rend le danger tangible (2026-07-05, demande explicite) : rappel au survol de la pénalité de
    // vitesse (toi) / bonus de vitesse (monstres aggro) en zone dangereuse -- voir isZoneDangerous()
    zb.title = b.cls === 'b-red'
      ? (LANG==='fr' ? '⚠️ Zone trop dure pour ton stuff : tu es ralenti, les monstres qui t\'ont repéré sont plus rapides' : '⚠️ Zone too hard for your gear: you are slowed down, monsters that spotted you are faster')
      : '';
    $('ztReq').innerHTML = `<span class="${apR>=1?'ok':'bad'}">${Math.floor(apEff())}/${z.reqAP} PA</span> · <span class="${dpR>=1?'ok':'bad'}">${Math.floor(totalDP())}/${z.reqDP} PD</span>`;
  }
}
// version complète : chiffres + reconstruction du DOM (192 cases d'inventaire, liste des 12 zones, paperdoll...)
// coûteuse — appelée automatiquement chaque seconde, et sur les actions peu fréquentes (loot, équiper, changer de zone)
// signatures bon marché pour éviter de reconstruire le DOM (192 cases + poupée + liste
// de zones) chaque seconde quand rien n'a réellement changé — avant ce correctif, hud()
// refaisait tout ce travail en continu, pour toujours, même quand le joueur ne looter/
// n'équipait/ne voyageait pas cette seconde-là précise
let lastInvSig = '', lastZoneSig = '';
function invSignature() {
  let s = '';
  for (let i = 0; i < INV_SIZE; i++) { const it = INV[i]; s += it ? (it.key+','+it.qty+','+(it.enhLv||0)) : '_'; s += '|'; }
  // EQUIP inclus depuis le 2026-07-14 (bug trouvé : "l'affichage ap dp au dessus du personnage
  // n'est parfois pas instantané et parfois figé mauvaise valeur") -- une réussite d'optimisation
  // change EQUIP[slot].enhLv SANS toucher au sac, donc cette signature ne changeait pas et
  // refreshInvUI()/renderEquipment() (le résumé PA/PD au-dessus du perso) ne se rafraîchissait que
  // par coïncidence, au prochain vrai changement de sac (loot/vente/équipement d'un autre objet)
  for (const k of Object.keys(EQUIP)) { const e = EQUIP[k]; s += e ? (e.key+','+(e.enhLv||0)) : '_'; s += '|'; }
  return s;
}
function zoneSignature() { return zoneIdx + ':' + atVelia + ':' + Math.round(apEff()) + ':' + Math.round(totalDP()); }

// badge "1" sur Wiki/Compendium/Codex/Succès après une modification de contenu, RETIRÉ dès que CE
// joueur ouvre le panneau (2026-07-06, demande explicite : "affiche plutot un numero qui s'enleve
// une fois lu et a l'interieur met en évidence ce qui a été modifié" — remplace la version
// précédente, un simple "NEW" clignotant pendant 24h pour tout le monde sans lien avec la lecture).
// Chaque entrée porte aussi une courte description ("desc") du changement, affichée en évidence en
// haut du panneau tant qu'il n'a pas encore été ouvert depuis ce changement.
// RÈGLE À SUIVRE DÉSORMAIS : mettre à jour "at" (et "desc") à chaque modification de contenu dans
// un de ces 4 panneaux.
// numéro de version PAR PANNEAU, pas un horodatage -- un 1er essai avec des dates ISO "à venir
// dans la journée" (ex: '...T07:00:00Z') s'est révélé cassé en le testant : si l'heure choisie est
// dans le FUTUR par rapport à l'horloge réelle au moment du déploiement, contentIsUnread() reste
// vrai pour toujours (aucun "vu" ne peut jamais dépasser une date future) -- le badge ne
// disparaissait JAMAIS, peu importe combien de fois le panneau était ouvert. Un simple compteur
// entier incrémenté à la main élimine tout risque de désynchronisation d'horloge.
const CONTENT_UPDATE_VERSION = {
  wiki:         { v:2, desc:{fr:'1 arme garantie sur les 3 dernières zones de chaque palier (plus rien sur la 1ère)',en:'1 guaranteed weapon on a tier\'s last 3 zones (none on the 1st)'} },
  compendium:   { v:1, desc:{fr:'Clique un objet pour voir dans quelles zones le farmer',en:'Click an item to see which zones farm it'} },
  codex:        { v:1, desc:{fr:'Liste à jour de tous les objets du jeu',en:'Up to date list of every item in the game'} },
  achievements: { v:1, desc:{fr:'Filtres par catégorie et "pas fini" disponibles',en:'Category and "unfinished" filters available'} },
};
function contentSeenKey(panel) { return 'velia-idle-seenv-'+panel; }
function contentLastSeenVersion(panel) {
  try { return parseInt(localStorage.getItem(contentSeenKey(panel))||'0', 10) || 0; } catch(e) { return 0; }
}
function contentIsUnread(panel) {
  const entry = CONTENT_UPDATE_VERSION[panel]; if (!entry) return false;
  return entry.v > contentLastSeenVersion(panel);
}
// à appeler à l'OUVERTURE de chaque panneau (après avoir déjà lu contentIsUnread pour l'affichage
// de cette ouverture précise) — le badge disparaît, mais la mise en évidence reste visible tant
// que le panneau affiché à l'écran ne s'est pas refermé/rouvert
function markContentSeen(panel) {
  const entry = CONTENT_UPDATE_VERSION[panel]; if (!entry) return;
  try { localStorage.setItem(contentSeenKey(panel), String(entry.v)); } catch(e) {}
  refreshContentNewBadges();
}
// callout affiché en haut du panneau tant qu'il n'a pas encore été ouvert depuis le changement
function contentChangeCalloutHtml(panel) {
  if (!contentIsUnread(panel)) return '';
  const entry = CONTENT_UPDATE_VERSION[panel]; if (!entry || !entry.desc) return '';
  return `<div class="contentNewCallout">🆕 ${escapeHtml(entry.desc[LANG]||entry.desc.fr)}</div>`;
}
function refreshContentNewBadges() {
  const map = { wiki:'newBadgeWiki', compendium:'newBadgeCompendium', codex:'newBadgeCodex', achievements:'newBadgeAchievements' };
  for (const key in map) {
    const el = $(map[key]); if (!el) continue;
    el.textContent = '1';
    el.classList.toggle('show', contentIsUnread(key));
  }
}

function hud() {
  refreshStatsOnly();
  drawZoneMobIcon();
  renderFarmModeBtn();
  const zSig = zoneSignature();
  // syncFarmCardHeights() force une lecture de mise en page (getBoundingClientRect) — coûteux à
  // répéter à CHAQUE appel de hud() (bien plus qu'1×/s en combat actif, hud() étant aussi appelé
  // après chaque loot/vente/équipement). Ne le refaire que quand la liste de zones est VRAIMENT
  // reconstruite (même déclencheur que buildZoneList) + au redimensionnement (voir plus bas) —
  // remonté en jeu le 2026-07-06 ("la souris se met à buguer si je garde les onglets ouverts") :
  // ce recalcul répété pendant des heures de session active était un coût inutile à éliminer,
  // même sans certitude que ce soit LA cause exacte du ralenti.
  if (zSig !== lastZoneSig) { lastZoneSig = zSig; buildZoneList(); syncFarmCardHeights(); }
  const iSig = invSignature();
  if (iSig !== lastInvSig) { lastInvSig = iSig; refreshInvUI(); }
  // silver/loyalty peuvent changer sans toucher à la composition du sac (récompense de succès,
  // de quête, de boss, achat...) -- mis à jour hors du gate d'invSignature, sinon l'affichage
  // reste visuellement obsolète jusqu'au prochain vrai changement d'inventaire
  const invSilverEl = $('invSilver'); if (invSilverEl) invSilverEl.textContent = fmt(S.silver);
  const invLoyaltyEl2 = $('invLoyalty'); if (invLoyaltyEl2) invLoyaltyEl2.textContent = '🏅 '+fmt(S.loyalty||0);
  ensureQuests('daily');
  ensureQuests('weekly');
  checkAchievements();
  updateQuestBadge();
  renderQuestWidget();
  renderQuestTrackerWidget();
  ensureLoyaltyGrant();
  updateMailBadge();
  refreshContentNewBadges();
  // resynchronise la pastille "notes de version non lues" en haut de page : elle doit disparaître
  // dès qu'un panneau se referme (quel que soit le chemin de fermeture — bouton ✕, clic sur le
  // fond, Échap...), voir updatePatchBadge (game-supabase.js)
  if (typeof updatePatchBadge === 'function') updatePatchBadge();
  // met en évidence "⚡ Équiper meilleur" dès qu'un objet oublié plus de 15s est meilleur que
  // l'équipé (2026-07-09, demande explicite) — recalculé chaque seconde (hud tourne sur un
  // setInterval(hud,1000)), pas besoin d'un timer dédié
  const equipBestBtn = $('btnEquipBest');
  if (equipBestBtn) equipBestBtn.classList.toggle('hasUpgrade', hasNeglectedUpgradeInBag());
}
// aligne la hauteur des cartes "Zones de farm" et "Loot de cette zone" sur celle de la carte
// Statistiques (demande explicite du 2026-07-06 : "fait en sorte que les carte zone de farm et
// loot de cette zone fasse la meme taille que statistique") -- #statsCard a un contenu fixe (13
// lignes), donc une hauteur assez stable ; les 2 autres ont un contenu variable (nb de zones/objets)
// plafonné jusqu'ici par un max-height:60vh fixe, sans rapport avec la hauteur réelle de
// Statistiques -- d'où l'écart visible. Mesure la hauteur RÉELLE de Statistiques et l'applique en
// max-height sur les listes internes (le défilement absorbe le surplus de contenu).
function syncFarmCardHeights() {
  const statsCard = $('statsCard');
  if (!statsCard) return;
  const targetH = statsCard.getBoundingClientRect().height;
  if (targetH < 50) return; // pas encore mis en page (ex: juste après le chargement)
  [['zonesCard','zoneList'], ['lootCard','lootTable']].forEach(([cardId, listId]) => {
    const card = $(cardId), list = $(listId);
    if (!card || !list) return;
    const overhead = card.getBoundingClientRect().height - list.getBoundingClientRect().height; // en-tête/onglets/marges
    const newListH = Math.max(80, Math.round(targetH - overhead));
    list.style.maxHeight = newListH + 'px';
  });
}
window.addEventListener('resize', () => { if (typeof syncFarmCardHeights === 'function') syncFarmCardHeights(); });
function hudFast() {
  $('stateName').textContent = STATE_FR[P.state]||P.state;
  if (P.hp > effHpMax()) P.hp = effHpMax(); // déséquiper une pièce peut faire baisser le max courant
  const hpPct = Math.max(0,P.hp/effHpMax()*100);
  $('hpFill').style.width = hpPct+'%';
  $('hpPct').textContent = Math.round(hpPct)+'%';
  // mana (2026-07-05, demande explicite) : même principe que la barre de PV, juste en dessous
  if (P.mp > effManaMax()) P.mp = effManaMax();
  const mpPct = Math.max(0,P.mp/effManaMax()*100);
  $('mpFill').style.width = mpPct+'%';
  $('mpPct').textContent = Math.round(mpPct)+'%';
  $('manaPotCd').style.height = (P.manaPotCd/MANA_POTION.cd*100)+'%';
  const pot = POTIONS[S.potionType] || POTIONS.medium;
  $('potCd').style.height = (P.potCd/pot.cd*100)+'%';
  // case unique vie+mana (2026-07-08) : l'icône est désormais FIXE (fiole vie+mana générique),
  // plus besoin de la changer selon la taille de potion choisie (ça reste géré dans le panneau) —
  // rendue une seule fois (innerHTML déjà posé au premier hud() suffit, voir plus bas)
  const dualIcon = $('potDualIcon');
  if (dualIcon && !dualIcon.dataset.set) { dualIcon.innerHTML = ICO_POTION_DUO; dualIcon.dataset.set = '1'; }
  const potCostNow = potionCost(pot.cost), manaCostNow = potionCost(MANA_POTION.cost);
  $('potSlot').title = pot.name[LANG] + (potCostNow>0 ? ` — ${fmt(potCostNow)} silver/${LANG==='fr'?'usage':'use'} (+${Math.round(effHpMax()*pot.heal)} PV, ${Math.round(pot.heal*100)}%, CD ${pot.cd}s)` : (LANG==='fr'?` — gratuite (CD ${pot.cd}s)`:` — free (CD ${pot.cd}s)`)) +
    ' · ' + MANA_POTION.name[LANG] + ` — ${fmt(manaCostNow)} silver/${LANG==='fr'?'usage':'use'} (+${Math.round(MANA_POTION.restore*100)}% MP, CD ${MANA_POTION.cd}s, auto)`;
  for (const s of SKILLS) {
    const el = skEls[s.id];
    el.querySelector('.cd').style.height = (cds[s.id]/s.cd*100)+'%';
    el.classList.toggle('cast', P.castingSkill===s);
    el.classList.toggle('buffed', s.type==='buff' && buffTimer>0);
  }
  renderCastBar();
}
// barre d'incantation (2026-07-05, demande explicite) : "----------o----------", la matière se
// retire des 2 côtés vers le centre au fil du temps -- le sort part quand elle a disparu. scaleX
// part de 1 (barre pleine) et va vers 0 (juste le point central) en suivant P.castProgress.
function renderCastBar() {
  const bar = $('castBar');
  if (!P.castingSkill) { bar.classList.remove('show'); return; }
  bar.classList.add('show');
  const remain = Math.max(0, 1 - P.castProgress);
  $('castBarLeft').style.transform = `scaleX(${remain})`;
  $('castBarRight').style.transform = `scaleX(${remain})`;
  $('castBarLabel').textContent = P.castingSkill.name;
}

// ==================== BOUCLE ====================
let last = performance.now();
// simulation extraite de loop() en fonction séparée (2026-07-15, demande explicite : "fais en sorte
// que le jeu ne s'arrete pas une fois changer d'onglet, on doit farmer meme sur un autre onglet du
// jeu ou du navigateur") -- retirer le check document.hidden (fait le 2026-07-14) ne suffisait PAS :
// requestAnimationFrame lui-même est THROTTLÉ/SUSPENDU par le navigateur dès que l'onglet n'est
// plus visible, quel que soit le code JS qui l'appelle -- aucune ligne de ce fichier ne peut
// changer ce comportement du navigateur. La vraie solution : un setInterval (voir tout en bas de
// cette fonction) qui, lui, continue de tourner en arrière-plan (juste clampé à ~1s minimum par les
// navigateurs, jamais suspendu comme rAF) prend le relais pour cette même fonction quand l'onglet
// est caché, avec un dt basé sur le temps RÉEL écoulé (pas un FPS supposé).
function advanceSim(now) {
  const dt = Math.min(2, (now-last)/1000); last = now;
  if (dt <= 0) return;
  // pendant un combat de boss (plein écran), on met le farm en pause : la salle de boss couvre
  // tout l'écran, inutile de continuer à simuler la zone de farm derrière
  if (bossState.active) return;
  // BUG trouvé le 2026-07-07 : cette respawn continue n'était jamais gardée par atVelia — Velia
  // partait bien à 0 pack (resetWorld), mais dès la frame suivante ce respawn en ajoutait jusqu'à
  // en avoir 6, remplissant en boucle la "zone paisible" de monstres. Confirmé par le joueur.
  if (!atVelia && packs.filter(p=>!p.dead).length < targetPackCount()) spawnPackNear();
  // les packs morts ne sont plus jamais dessinés (voir render()) ni utilisés ailleurs —
  // avant ce correctif ils restaient dans le tableau tant que le joueur ne s'éloignait pas
  // de 900 unités, ce qui faisait grossir `packs` indéfiniment sur une session de farm
  // prolongée dans la même zone et ralentissait le jeu de plus en plus au fil du temps.
  packs = packs.filter(p=>!p.dead);
  corpses.forEach(c=>c.life-=dt); corpses = corpses.filter(c=>c.life>0);
  floats.forEach(f=>f.life-=dt); floats = floats.filter(f=>f.life>0);

  fsm(dt);
  wolvesTick(dt);
  dropsTick(dt);
  particlesTick(dt);

  cam.x += (P.x-cam.x)*Math.min(1,dt*4);
  cam.y += (P.y-cam.y)*Math.min(1,dt*4);
}
function loop(now) {
  if (bossState.active) { requestAnimationFrame(loop); return; }
  advanceSim(now);
  render(now/1000);
  hudFast();
  requestAnimationFrame(loop);
}
// filet de secours en arrière-plan (2026-07-15) : ne fait RIEN tant que l'onglet est visible (rAF
// s'en charge déjà, ce setInterval serait redondant) -- dès que l'onglet est caché, prend le relais
// pour que kills/loot/déplacement continuent réellement d'avancer, pas juste "en théorie"
setInterval(() => { if (document.hidden) advanceSim(performance.now()); }, 1000);

// Inventaire/Equipement -- UI (paperdoll, grille, enchantement, auto-opti) -> voir inventory-ui.js (charge APRES boss.js, AVANT render.js -- voir index.html)
// ==================== SAUVEGARDE (prêt pour Supabase) ====================
// Rassemble tout l'état du joueur en un objet JSON sérialisable.
// C'est CE bloc qui doit être envoyé/lu depuis la table Supabase "game_saves".
function getSaveState() {
  return {
    version: 1,
    S: { ...S },
    EQUIP: JSON.parse(JSON.stringify(EQUIP)),
    INV: JSON.parse(JSON.stringify(INV)),
    COMPENDIUM_BAG: JSON.parse(JSON.stringify(COMPENDIUM_BAG)),
    VELIA_CHEST: JSON.parse(JSON.stringify(VELIA_CHEST)),
    zoneIdx,
    playerPos: { x: P.x, y: P.y },
    savedAt: new Date().toISOString(),
  };
}
function applySaveState(data) {
  if (!data || data.version !== 1) return false;
  Object.assign(S, data.S);
  // repart sur une base FRAÎCHE pour les stats de SESSION (silver/h, kills/min) — voir le
  // commentaire sur silverEarnedAtLoad/killsAtLoad plus haut ; corrige le faux positif anti-triche
  // du 2026-07-06 (silver_per_hour astronomique juste après le chargement d'une sauvegarde)
  S.startTime = performance.now();
  S.silverEarnedAtLoad = S.silverEarned || 0;
  S.tokenSilverEarnedAtLoad = S.tokenSilverEarned || 0;
  S.killsAtLoad = S.kills || 0;
  Object.keys(EQUIP).forEach(k => EQUIP[k] = data.EQUIP[k] ?? null);
  for (let i = 0; i < INV_SIZE; i++) INV[i] = data.INV[i] ?? null;
  // sac "Compendium" (2026-07-08) : absent des sauvegardes antérieures à cette version, ?? null
  // migre proprement les anciennes sauvegardes (toutes les cases restent vides, rien à perdre)
  for (let i = 0; i < INV_SIZE; i++) COMPENDIUM_BAG[i] = data.COMPENDIUM_BAG?.[i] ?? null;
  // coffre de ville (2026-07-16) : même migration douce que le sac Compendium ci-dessus
  for (let i = 0; i < INV_SIZE; i++) VELIA_CHEST[i] = data.VELIA_CHEST?.[i] ?? null;
  if (!S.migratedGearRebalanceV158) { migrateGearRebalanceV158(); S.migratedGearRebalanceV158 = true; }
  if (!S.migratedEarringRebalanceV175) { migrateEarringRebalanceV175(); S.migratedEarringRebalanceV175 = true; }
  if (!S.migratedArmorNoApV192) { migrateArmorNoApV192(); S.migratedArmorNoApV192 = true; }
  if (!S.migratedJewelryApV207) { migrateJewelryApV207(); S.migratedJewelryApV207 = true; }
  if (!S.migratedGearFixedStatsV226) { migrateGearFixedStatsV226(); S.migratedGearFixedStatsV226 = true; }
  if (!S.migratedGearRescaleV235) { migrateGearRescaleV235(); S.migratedGearRescaleV235 = true; }
  if (!S.migratedJewelryMatNameV239) { migrateJewelryMatNameV239(); S.migratedJewelryMatNameV239 = true; }
  if (!S.migratedGearRescaleV243) { migrateGearRescaleV243(); S.migratedGearRescaleV243 = true; }
  if (!S.migratedGearRescaleV245) { migrateGearRescaleV245(); S.migratedGearRescaleV245 = true; }
  zoneIdx = data.zoneIdx || 0;
  S.maxZoneIdx = Math.max(S.maxZoneIdx||0, zoneIdx); // rattrape les vieilles sauvegardes sans ce champ
  S.xpNext = xpNeededFor(S.lvl); // migre les anciennes sauvegardes (ancienne courbe ×1.35) vers la vraie table BDO
  if (!POTIONS[S.potionType]) S.potionType = 'medium'; // migre l'ancienne potion unique 'basic' vers les 4 tailles
  // BUG trouvé le 2026-07-15 (demande explicite : "au reload, apres maj le joueur arrive dans une
  // zone vide, fais en sorte qu'il trouve rapidement des monstre") : resetWorld() fait spawn tous
  // les packs autour de P.x/P.y -- or à ce stade P.x/P.y valaient encore (0,0) (position par défaut),
  // la vraie position sauvegardée n'était restaurée QU'APRÈS, sur la ligne suivante. Le joueur se
  // téléportait donc sur sa position réelle pendant que tous les monstres restaient massés près de
  // l'origine, potentiellement à des centaines d'unités -- d'où la "zone vide" au reload. Restaurer
  // playerPos AVANT resetWorld() pour que les packs spawnent bien autour du joueur.
  if (data.playerPos) { P.x = data.playerPos.x; P.y = data.playerPos.y; }
  resetWorld(true); // recrée les packs autour de la vraie position du joueur (keepPos, voir commentaire sur resetWorld)
  updateZoneTitleText(); // voir son commentaire -- sans cet appel, le nom de zone affiché restait figé au placeholder HTML
  hud();
  return true;
}
// Export manuel (bouton à brancher si besoin) : télécharge un .json local
function exportSaveToFile() {
  const blob = new Blob([JSON.stringify(getSaveState(), null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'velia-idle-save.json';
  a.click();
}
// Import manuel depuis un fichier .json choisi par le joueur
function importSaveFromFile(file) {
  const reader = new FileReader();
  reader.onload = e => { try { applySaveState(JSON.parse(e.target.result)); } catch(err) { console.error('Sauvegarde invalide', err); } };
  reader.readAsText(file);
}
// Ces 4 fonctions sont exposées globalement : un futur wrapper React/Supabase
// pourra appeler window.getSaveState() avant de fermer, et window.applySaveState(json) au chargement.
window.getSaveState = getSaveState;
window.applySaveState = applySaveState;
window.exportSaveToFile = exportSaveToFile;
window.importSaveFromFile = importSaveFromFile;

// demarrage du jeu deplace dans render.js (voir commentaire la-bas)
