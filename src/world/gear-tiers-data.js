// ==================== PALIERS DE STUFF & ECHELLE DE PUISSANCE (GEAR_TIERS, GEAR_ROLE...) ====================
// Extrait de game-core.js le 2026-07-08 (reorganisation par dossiers) -- charge APRES
// inventory/gear-icons.js (GEAR_TIERS lit ICO_MAT_* immediatement) et APRES world/zones-data.js
// (gearTierForZone/gearDropChance ne lisent ZONES qu'a l'execution, pas au chargement -- l'ordre
// entre ce fichier et zones-data.js n'a pas d'importance stricte, mais on le charge apres par
// coherence). N'est PAS un pur fichier de donnee (contient aussi quelques petites fonctions
// d'accès : gearTierForZone, gearDropChance, jewelDropChance, gearFloor).
// équipement lootable : 4 paliers de stuff EARLY (demande du 2026-07-05), 3 zones chacun.
// Naru/Tuvala gardent la courbe de drop décroissante par zone ; Yuria/Grunil ont une chance de
// drop FIXE (2%) quelle que soit la zone parmi les leurs — chaque palier a son propre matériau
// d'optimisation (remplace l'ancien matériau générique par zone).
const GEAR_TIERS = [
  // zones étendues à 4 par palier le 2026-07-05 (voir commentaire sur les nouvelles zones dans
  // ZONES) -- les 4e zones (12,13,14,15) sont ajoutées à la fin du tableau, jamais insérées, donc
  // aucun index existant ne bouge
  // noms d'armes alignés sur la classe sorcier le 2026-07-08 (demande explicite : "l'arme c'est un
  // baton de sorcier... l'arme secondaire c'est une dague") — armure/bijoux inchangés
  { grade:'grey', color:'#b8b8b8', zones:[0,1,2,12], label:{fr:'Gris — Naru',en:'Grey — Naru'},
    sets:{ weapon:'Bâton Naru', awakening:'Éveil Naru', secondary:'Dague Naru',
           helmet:'Casque Naru', armor:'Armure Naru', gloves:'Gants Naru', boots:'Bottes Naru' },
    material:{ name:'Pierre de Novice', icon:ICO_MAT_NOVICE, color:'#b8b8b8' }, dropChance:null },
  { grade:'white', color:'#e8e8e8', zones:[3,4,5,13], label:{fr:'Blanc — Tuvala',en:'White — Tuvala'},
    sets:{ weapon:'Bâton Tuvala', awakening:'Éveil Tuvala', secondary:'Dague Tuvala',
           helmet:'Casque Tuvala', armor:'Armure Tuvala', gloves:'Gants Tuvala', boots:'Bottes Tuvala' },
    material:{ name:'Pierre du Temps', icon:ICO_MAT_TEMPS, color:'#cfd8dc' }, dropChance:null },
  { grade:'green', color:'#7aa35e', zones:[6,7,8,14], label:{fr:'Vert — Yuria',en:'Green — Yuria'},
    sets:{ weapon:'Bâton Yuria', awakening:'Éveil Yuria', secondary:'Dague Yuria',
           helmet:'Casque Yuria', armor:'Plastron Yuria', gloves:'Gants Yuria', boots:'Bottes Yuria' },
    material:{ name:'Pierre Noire', icon:ICO_MAT_NOIRE, color:'#7aa35e' }, dropChance:0.02 }, // même vert EXACT que le stuff Yuria (demande explicite du 2026-07-08)
  { grade:'blue', color:'#6ea3c9', zones:[9,10,11,15], label:{fr:'Bleu — Grunil',en:'Blue — Grunil'},
    sets:{ weapon:'Bâton Grunil', awakening:'Éveil Grunil', secondary:'Dague Grunil',
           helmet:'Casque Grunil', armor:'Plastron Grunil', gloves:'Gants Grunil', boots:'Bottes Grunil' },
    // Pierre concentrée dédiée à Grunil depuis le 2026-07-06 (avant : partageait la Pierre Noire
    // de Yuria, ce qui mélangeait les 2 paliers) — Yuria (vert) garde la Pierre Noire
    material:{ name:'Pierre concentrée', icon:ICO_MAT_CONCENTREE, color:'#6ea3c9' }, dropChance:0.02 },
];
/** @param {number} zi - index de zone. @returns {object} le palier GEAR_TIERS qui contient cette zone (repli sur le dernier palier si absente). */
function gearTierForZone(zi) { return GEAR_TIERS.find(t => t.zones.includes(zi)) || GEAR_TIERS[GEAR_TIERS.length-1]; }
// chance de drop d'une pièce d'équipement, décroissante zone par zone — utilisée par Naru/Tuvala
// (dropChance:null) ; Yuria/Grunil utilisent leur taux fixe défini ci-dessus à la place.
// indices 12/13 (4e zone grey/white, 2026-07-05) continuent la même décroissance locale ; 14/15
// ne sont jamais lus (green/blue ont un dropChance fixe), gardés pour la cohérence du tableau.
const GEAR_CHANCE = [.16,.12,.09,.065,.046,.032,.021,.014,.009,.0055,.0032,.0018,.065,.022,.0014,.0014];
// table de loot "V2" (2026-07-15, demande explicite, valeurs fournies par capture d'écran) : taux
// FIXE par palier (armure et arme partagent le même taux, bijou moitié moins) — remplace le système
// V1 ci-dessus (décroissance par zone via GEAR_CHANCE + tier.dropChance) le temps que S.lootTableVersion
// vaille 'v2'. L'ancien système V1 reste intégralement en place et réactivable à tout moment (demande
// explicite : "garde a memoire v1 le loot davant et ça c'est la v2 a tout moment je repasse en v1") --
// voir gearDropChance/jewelDropChance ci-dessous, et le sélecteur admin (renderLootVersionToggle).
const LOOT_RATES_V2 = {
  grey:  { gear:0.0576, jewel:0.0288 },
  white: { gear:0.0288, jewel:0.0144 },
  green: { gear:0.0144, jewel:0.0072 },
  blue:  { gear:0.0072, jewel:0.0036 },
};
// copie MUTABLE de LOOT_RATES_V2, éventuellement remplacée par un override admin chargé depuis
// Supabase (table game_config, clé 'loot_rates_v2') -- voir refreshLiveLootRates() dans
// src/backend/game-supabase.js et l'éditeur admin dans src/admin/admin-economy.js (2026-07-19).
// gearDropChance/jewelDropChance lisent TOUJOURS cette copie, jamais LOOT_RATES_V2 directement --
// LOOT_RATES_V2 reste la référence "valeurs par défaut du jeu", jamais mutée elle-même.
let LOOT_RATES_LIVE = JSON.parse(JSON.stringify(LOOT_RATES_V2));
/**
 * Chance de drop d'armure/arme pour CE palier/CETTE zone, selon la version de table active
 * (S.lootTableVersion). `zi` est explicite (pas juste zoneIdx global) pour rester utilisable
 * aussi bien lors d'un vrai tirage (zone actuellement farmée) que pour l'AFFICHAGE de la table de
 * loot d'une zone PRÉVISUALISÉE (zoneLootRowsHtml peut montrer une zone différente de celle qu'on
 * farme).
 * @param {object} tier - palier de gear (GEAR_TIERS), lit .grade et .dropChance.
 * @param {number} zi - index de zone (ZONES), utilisé seulement en V1 (fallback GEAR_CHANCE[zi]).
 * @returns {number} chance de drop (0-1) — lit LOOT_RATES_LIVE[tier.grade].gear en V2, sinon
 *   tier.dropChance ou GEAR_CHANCE[zi] (défaut 0.002) en V1.
 */
function gearDropChance(tier, zi) {
  if (S.lootTableVersion === 'v2') return LOOT_RATES_LIVE[tier.grade].gear;
  return tier.dropChance != null ? tier.dropChance : (GEAR_CHANCE[zi] ?? .002);
}
/**
 * Chance de drop de bijou pour CE palier, selon la version de table active.
 * @param {object} tier - palier de gear (GEAR_TIERS), lit .grade.
 * @param {number} v1FallbackCh - valeur V1 propre à CETTE zone (ZONES[zi].loot.jackpot.ch),
 *   utilisée telle quelle quand la V1 est active.
 * @returns {number} chance de drop (0-1) — lit LOOT_RATES_LIVE[tier.grade].jewel en V2, sinon
 *   v1FallbackCh en V1.
 */
function jewelDropChance(tier, v1FallbackCh) {
  if (S.lootTableVersion === 'v2') return LOOT_RATES_LIVE[tier.grade].jewel;
  return v1FallbackCh;
}
// rééquilibrage du 2026-07-05 (demande explicite) : les armes (weapon/awakening/secondary) ne
// tirent plus au hasard le même emplacement que l'armure — chaque zone garantit désormais un type
// d'arme précis (voir ZONE_WEAPON_SLOTS/rollWeaponDrop), donc GEAR_SLOTS ne couvre plus QUE les 4
// pièces d'armure, tirées au hasard entre elles comme avant.
const GEAR_SLOTS = ['helmet','armor','gloves','boots'];
// quel(s) type(s) d'arme chaque zone garantit (2026-07-05, demande explicite : "1 arme dans chaque
// zone") — cycle weapon→secondary→awakening sur les 3 zones de chaque palier. Le palier bleu a
// désormais lui aussi 3 zones (Planque des Mânes ajoutée le 2026-07-05) : la rotation complète
// remplace le compromis provisoire "2 armes sur la dernière zone" utilisé tant qu'il n'y avait que
// 2 zones bleues.
// rééquilibré le 2026-07-06 (demande explicite : "divise aussi les 3 armes dans les 3 dernieres
// zones de chaque couleurs") : avant, les 3 armes se répartissaient sur les 3 PREMIÈRES zones (la
// 4e répétait 'weapon' en double). Désormais, les 3 armes se répartissent sur les 3 DERNIÈRES zones
// du palier — la toute première zone de chaque palier ne garantit plus aucune arme (seulement sa
// pièce d'armure, voir ZONE_ARMOR_SLOTS), symétrique à l'armure qui, elle, laisse sa 4e zone sans
// répétition. Chaque type d'arme n'apparaît donc plus qu'UNE seule fois par palier (au lieu de 2).
// Bâton Naru exclusif à Camp des Loups (2026-07-08, demande explicite : "baton naru lootable
// exclusivement camp des loups") -- le palier gris est le seul où l'arme vient de la 1ère zone au
// lieu de la 2e : cohérent avec le spawn sans arme (2026-07-08), la toute première zone du jeu
// donne directement de quoi se défendre, plutôt que de forcer à survivre une zone entière à mains
// nues avant le premier drop d'arme.
const ZONE_WEAPON_SLOTS = [
  ['weapon'], [], ['secondary'],                  // grey : zones 0,1 (rien),2
  [], ['weapon'], ['secondary'],                  // white : zones 3 (rien),4,5
  [], ['weapon'], ['secondary'],                  // green : zones 6 (rien),7,8
  [], ['weapon'], ['secondary'],                  // blue : zones 9 (rien),10,11
  // 4e zone de chaque palier : complète la rotation avec l'éveil (2026-07-05 : "1 arme dans chaque
  // zone" -- corrigé le 2026-07-06 pour ne plus jamais répéter un type sur 2 zones du même palier)
  ['awakening'],                                   // grey : zone 12 (Ruines de Trent)
  ['awakening'],                                   // white : zone 13 (Île d'Iliya)
  ['awakening'],                                   // green : zone 14 (Base de Bashim)
  ['awakening'],                                   // blue : zone 15 (Forêt de Polly)
];
// quelle pièce d'armure chaque zone garantit (2026-07-06, demande explicite : "les 4 zones donnent
// 1 seule pièce d'armure casque/armure/bottes/gants") — remplace l'ancien tirage au hasard partagé
// entre les 4 zones du palier (rollGearDrop piochait au hasard dans GEAR_SLOTS). Chaque palier a
// désormais EXACTEMENT 4 zones (voir le commentaire sur les nouvelles zones dans ZONES) : mapping
// 1-pour-1 parfait avec les 4 pièces d'armure, même logique que ZONE_WEAPON_SLOTS pour les armes.
// Les 3 premières zones de chaque palier donnent casque/armure/gants, la 4e zone (ajoutée le
// 2026-07-05, voir ZONES) donne les bottes.
const ZONE_ARMOR_SLOTS = [
  ['helmet'], ['armor'], ['gloves'],              // grey : zones 0,1,2
  ['helmet'], ['armor'], ['gloves'],              // white : zones 3,4,5
  ['helmet'], ['armor'], ['gloves'],              // green : zones 6,7,8
  ['helmet'], ['armor'], ['gloves'],              // blue : zones 9,10,11
  ['boots'],                                       // grey : zone 12 (Ruines de Trent)
  ['boots'],                                       // white : zone 13 (Île d'Iliya)
  ['boots'],                                       // green : zone 14 (Base de Bashim)
  ['boots'],                                       // blue : zone 15 (Forêt de Polly)
];
// part du PA/PD requis de zone que chaque pièce peut apporter, selon son rôle
// (l'éveil est l'arme la plus forte en PA dans le vrai jeu, la secondaire un peu moins que l'arme principale)
// hpShare : part du bonus de PV que chaque pièce d'armure apporte (le plastron/casque protègent
// le plus de vitals, gants/bottes un peu moins) — somme = 1.0 sur les 4 pièces d'armure
// dodgeShare (2026-07-08) : l'Esquive ne vient QUE de l'armure (jamais des armes), répartie à
// parts égales sur les 4 pièces — voir DODGE_GEAR_SCALE pour la conversion en % réel
// RÉÉQUILIBRAGE du 2026-07-05 (demande explicite) : les armes donnaient bien trop de PA (à elles
// 3, ~750 PA au PEN en bleu, contre ~460 PD total) — apShare/dpShare recalculés pour qu'un stuff
// COMPLET du palier bleu (3 armes + 4 armures + bijoux) totalise ~301 PA / ~248 PD au PEN (×2.33,
// voir enhBonus(20)), chaque palier plus bas donnant proportionnellement moins (la formule suit le
// PA/PD requis de zone, qui grandit à chaque palier) — voir docs/roadmap.md pour le détail du calcul.
// AP retiré des 4 pièces d'armure (2026-07-06, demande explicite : "les armures ne donnent pas
// d'AP") — comme dans le vrai jeu, l'armure est purement défensive (PD/PV/Esquive), seules les
// armes apportent de l'AP. L'ancien total d'AP armure (.0204+.0204+.0163+.0163 = .0734) est
// redistribué aux 3 armes en conservant leurs proportions relatives (×1.271), pour que le total
// d'AP d'un stuff complet reste EXACTEMENT le même qu'avant — préserve tel quel le calibrage
// PA/PD des transitions de palier de couleur fait le 2026-07-06 (voir ENH_STEP/palier PRI).
const GEAR_ROLE = {
  weapon:     { apShare:0.1139, dpShare:0,      hpShare:0,    dodgeShare:0 },
  awakening:  { apShare:0.1491, dpShare:0,      hpShare:0,    dodgeShare:0 },
  secondary:  { apShare:0.0813, dpShare:0,      hpShare:0,    dodgeShare:0 },
  helmet:     { apShare:0,      dpShare:0.1272, hpShare:0.30, dodgeShare:0.25 },
  armor:      { apShare:0,      dpShare:0.1272, hpShare:0.40, dodgeShare:0.25 },
  gloves:     { apShare:0,      dpShare:0.0954, hpShare:0.15, dodgeShare:0.25 },
  boots:      { apShare:0,      dpShare:0.0954, hpShare:0.15, dodgeShare:0.25 },
  // bijoux (jackpot ring/necklace/earring/belt) — ajouté le 2026-07-08 (demande explicite :
  // "revois ce que donne le stuff et aligne avec toute les autre stuff") : l'AP des bijoux était
  // jusqu'ici une valeur FIGÉE par zone (jackpot.ap dans ZONES), jamais recalculée quand reqAP a
  // changé (V201-V206) — complètement désynchronisée du reste du stuff, qui scale TOUJOURS
  // dynamiquement depuis reqAP. Les bijoux suivent désormais la même règle (voir rollDrops).
  jackpot:    { apShare:0.10,   dpShare:0,      hpShare:0,    dodgeShare:0 },
};
// plancher minimum (2026-07-08) : évite qu'une zone à faible reqAP/reqDP (ex: Camp des Loups,
// gearBasisAP volontairement bas pour le combat) ne produise un stuff à 0 PA/PD après arrondi
/** @param {number} v. @returns {number} arrondi avec plancher à 1 (évite un stuff à 0 PA/PD sur une zone à faible base). */
function gearFloor(v) { return Math.max(1, Math.round(v)); }
// facteur d'échelle des PV d'armure par rapport au PD requis de zone (calibré pour qu'un stuff
// d'armure complet et adapté à la zone évite un one-shot même en subissant la pénalité de PD
// insuffisante, cf dmgTakenMult qui monte jusqu'à ×4,5)
const HP_GEAR_SCALE = 9;
// facteur d'échelle de l'Esquive (en points de %) par rapport au PD requis de zone — volontairement
// beaucoup plus petit que HP_GEAR_SCALE : à endgame (zone 10, reqDP~239), un stuff complet adapté
// donne environ 19% d'esquive brute, avant le facteur d'efficacité (voir dodgeEffectiveness)
const DODGE_GEAR_SCALE = 0.08;
