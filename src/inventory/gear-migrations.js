// ==================== MIGRATIONS RETROACTIVES DU STUFF ====================
// Extrait de inventory-ui.js le 2026-07-08 (reorganisation par dossiers) -- DOIT charger APRES
// inventory-ui.js (appelees depuis applySaveState() dans core/game-core.js, en execution
// uniquement -- aucune evaluation immediate ici).
// migration RÉTROACTIVE du rééquilibrage PA/PD des armes/armures/bijoux (V158, 2026-07-05, demande
// explicite : "le stuff est rétroactif, modifie celui déjà existant") — sans elle, tout objet
// DÉJÀ tombé chez un joueur garderait ses anciennes stats (bien plus hautes pour les armes),
// coexistant avec les nouveaux drops rééquilibrés, ce qui n'était pas voulu.
//
// Pour l'armure/les armes : l'ancien PA/PD de base = reqAP/reqDP de la zone × ANCIENNE part × un
// facteur aléatoire tiré au drop (jamais stocké sur l'objet). Comme ce facteur est le MÊME des deux
// côtés de l'équation, le nouveau PA/PD = ancien × (nouvelle part / ancienne part) — pas besoin de
// connaître la zone d'origine exacte de l'objet, le ratio suffit.
//
// Pour les bijoux (jackpot) : les valeurs n'ont jamais été une formule, juste des nombres choisis à
// la main par objet — remplacés directement par la nouvelle valeur, identifiée par leur NOM.
const GEAR_RESCALE_RATIO_AP = {
  weapon: 0.0896/0.42, awakening: 0.1173/0.55, secondary: 0.0640/0.30,
  helmet: 0.0204/0.05, armor: 0.0204/0.05, gloves: 0.0163/0.04, boots: 0.0163/0.04,
};
const GEAR_RESCALE_RATIO_DP = {
  helmet: 0.1272/0.24, armor: 0.1272/0.24, gloves: 0.0954/0.18, boots: 0.0954/0.18,
};
const JEWELRY_NEW_AP = {
  'Anneau Naru':1, 'Collier Naru':1, 'Ceinture Naru':1,
  'Anneau Tuvala':2, 'Collier Tuvala':3, 'Ceinture Tuvala':4,
  'Anneau Asula':4, 'Collier Asula':7, 'Ceinture Asula':10,
  'Anneau de Cadry':8, "Serap's Necklace":13,
};
/** Migration rétroactive V158 : réapplique le rééquilibrage PA/PD des armes/armures (ratio) et bijoux (valeur figée par nom) à tout objet déjà possédé (équipé/sac/Compendium). */
function migrateGearRebalanceV158() {
  const rescaleOne = it => {
    if (!it) return;
    if (it.kind === 'gear' && it.slot) {
      const rAp = GEAR_RESCALE_RATIO_AP[it.slot];
      if (rAp != null) it.ap = Math.round((it.ap||0) * rAp);
      const rDp = GEAR_RESCALE_RATIO_DP[it.slot];
      if (rDp != null) it.dp = Math.round((it.dp||0) * rDp);
      // hp/dodge inchangés : leurs parts (hpShare/dodgeShare) n'ont pas été modifiées par V158
    } else if (it.kind === 'jackpot' && JEWELRY_NEW_AP[it.name] != null) {
      it.ap = JEWELRY_NEW_AP[it.name];
    }
  };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}
// ajout des boucles d'oreille (2026-07-05, demande explicite) : le PA des bijoux déjà existants
// (anneau/collier/ceinture, sauf le palier gris resté à 1) est redistribué pour laisser de la
// place à la boucle d'oreille sans changer le total PA du palier -- voir le commentaire sur les
// nouvelles zones dans ZONES pour le détail du calcul
const JEWELRY_NEW_AP_V175 = {
  'Anneau Tuvala':1, 'Collier Tuvala':2, 'Ceinture Tuvala':3,
  'Anneau Asula':2, 'Collier Asula':4, 'Ceinture Asula':6,
  'Anneau de Cadry':6, "Serap's Necklace":9, "Orkinrad's Belt":10,
};
/** Migration rétroactive V175 : redistribue le PA des bijoux déjà possédés (ajout des boucles d'oreille, total PA du palier inchangé). */
function migrateEarringRebalanceV175() {
  const rescaleOne = it => { if (it && it.kind === 'jackpot' && JEWELRY_NEW_AP_V175[it.name] != null) it.ap = JEWELRY_NEW_AP_V175[it.name]; };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}
// AP retiré des armures, redistribué aux armes (2026-07-06, demande explicite : "les armures ne
// donnent pas d'AP") — voir GEAR_ROLE. Rétroactif sur le stuff déjà possédé : armure → AP à 0,
// armes → ×1.271 (même ratio que le nouveau/l'ancien apShare total, préserve le total AP du stuff).
const GEAR_RESCALE_RATIO_AP_V192 = {
  weapon: 1.271, awakening: 1.271, secondary: 1.271,
  helmet: 0, armor: 0, gloves: 0, boots: 0,
};
/** Migration rétroactive V192 : retire l'AP des armures déjà possédées (mis à 0) et le redistribue aux armes (×1.271, préserve le total AP du stuff). */
function migrateArmorNoApV192() {
  const rescaleOne = it => {
    if (!it || it.kind !== 'gear' || !it.slot) return;
    const r = GEAR_RESCALE_RATIO_AP_V192[it.slot];
    if (r != null) it.ap = Math.round((it.ap||0) * r);
  };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}
// nom du bijou (jackpot) → index de zone qui le drope — chaque zone a un nom UNIQUE de bijou,
// donc cette table est sans ambiguïté (voir ZONES[i].loot.jackpot.name)
const JACKPOT_NAME_TO_ZONE = {
  'Anneau Naru':0, 'Collier Naru':1, 'Ceinture Naru':2,
  'Anneau Tuvala':3, 'Collier Tuvala':4, 'Ceinture Tuvala':5,
  'Anneau Asula':6, 'Collier Asula':7, 'Ceinture Asula':8,
  'Anneau de Cadry':9, "Serap's Necklace":10, "Orkinrad's Belt":11,
  'Boucle Naru':12, 'Boucle Tuvala':13, 'Boucle Asula':14, "Tungrad's Earring":15,
};
// migration 2026-07-08 (demande explicite : "revois ce que donne le stuff et aligne avec toute
// les autre stuff") : l'AP des bijoux (jackpot) était une valeur FIGÉE par zone dans ZONES, jamais
// recalculée après les changements de reqAP (V201-V206) — un bijou déjà en sac/équipé gardait
// l'ancien chiffre pour toujours, désynchronisé du stuff nouvellement dropé (qui, lui, utilise
// désormais gearFloor(gearBasisAP*apShare), voir rollDrops). Recalcule l'AP de BASE (avant
// enchantement, qui reste géré par enhBonus/itemMult comme d'habitude) de tout bijou déjà possédé.
/** Migration rétroactive V207 : recalcule l'AP de base de tout bijou déjà possédé depuis le reqAP actuel de sa zone d'origine (JACKPOT_NAME_TO_ZONE), au lieu d'une valeur figée au moment du drop. */
function migrateJewelryApV207() {
  const rescaleOne = it => {
    if (!it || it.kind !== 'jackpot') return;
    const zi = JACKPOT_NAME_TO_ZONE[it.name];
    if (zi == null) return;
    const zone = ZONES[zi];
    it.ap = gearFloor((zone.gearBasisAP ?? zone.reqAP) * GEAR_ROLE.jackpot.apShare);
  };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}
// retrouve la zone d'origine d'une pièce de GEAR déjà possédée (armure/arme) à partir de son
// palier (couleur) + son slot -- contrairement aux bijoux (1 nom unique par zone, voir
// JACKPOT_NAME_TO_ZONE), un nom de gear est partagé par tout un palier ; mais chaque (palier,slot)
// ne correspond qu'à UNE SEULE zone (voir ZONE_ARMOR_SLOTS/ZONE_WEAPON_SLOTS, 1 pièce garantie par
// zone), donc la paire reste sans ambiguïté.
/** @param {object} item - pièce de gear (armure/arme) déjà possédée, lit .color et .slot. @returns {number|null} index de la zone d'origine (palier+slot est sans ambiguïté, voir ZONE_ARMOR_SLOTS/ZONE_WEAPON_SLOTS), null si introuvable. */
function zoneForGearPiece(item) {
  const tierIdx = GEAR_TIERS.findIndex(t => t.color === item.color);
  if (tierIdx === -1) return null;
  const tier = GEAR_TIERS[tierIdx];
  for (const zi of tier.zones) {
    if ((ZONE_ARMOR_SLOTS[zi]||[]).includes(item.slot) || (ZONE_WEAPON_SLOTS[zi]||[]).includes(item.slot)) return zi;
  }
  return null;
}
// migration 2026-07-10 (demande explicite : "vérifie la rétroactivité lors de modification de
// stuff pour tout objet déjà existant") : les stats de BASE du gear (ap/dp/hp/dodge) et le prix de
// revente (val, gear ET bijoux) sont figés sur l'objet dès son drop, jamais recalculés tout seuls —
// la V226 (stats FIXES, plus de ±15% aléatoire) et la V225 (revente du gear/bijou fortement
// réduite, voir GEAR_SELL_MULT/JACKPOT_VAL_TRASH_RATIO) ne s'appliquaient donc QU'aux nouveaux
// drops, laissant tout le stuff déjà possédé sur l'ancien tirage aléatoire et l'ancien prix. Cette
// migration recalcule les 2 pour tout gear/bijou déjà en sac/équipé/protégé, avec EXACTEMENT la
// même formule que rollGearDrop/rollWeaponDrop/rollDrops (jamais dupliquée à la main) — seul
// l'enchantement (enhLv, géré séparément par enhBonus/itemMult) reste inchangé.
/** Migration rétroactive V226 : recalcule ap/dp/hp/dodge/val de tout gear/bijou déjà possédé avec EXACTEMENT la formule de rollGearDrop/rollDrops (stats fixes, plus d'aléatoire ±15%, prix de revente réduit). */
function migrateGearFixedStatsV226() {
  const rescaleOne = it => {
    if (!it) return;
    if (it.kind === 'gear' && it.slot) {
      const zi = zoneForGearPiece(it);
      if (zi == null) return;
      const zone = ZONES[zi];
      const role = GEAR_ROLE[it.slot];
      const basisAP = zone.gearBasisAP ?? zone.reqAP, basisDP = zone.gearBasisDP ?? zone.reqDP;
      it.ap = role.apShare ? gearFloor(basisAP * role.apShare) : 0;
      it.dp = role.dpShare ? gearFloor(basisDP * role.dpShare) : 0;
      it.hp = role.hpShare ? gearFloor(basisDP * role.hpShare * HP_GEAR_SCALE) : 0;
      it.dodge = Math.round(basisDP * (role.dodgeShare||0) * DODGE_GEAR_SCALE * 100) / 100;
      it.val = Math.round((it.ap*2 + it.dp + it.hp*0.5) * GEAR_SELL_MULT);
    } else if (it.kind === 'jackpot') {
      const zi = JACKPOT_NAME_TO_ZONE[it.name];
      if (zi == null) return;
      it.val = gearFloor(ZONES[zi].loot.trash.val * JACKPOT_VAL_TRASH_RATIO);
    }
  };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}
// migration 2026-07-11 (demande explicite : "Tout les stuff sont strictement sans range,
// rétroactif") : migrateGearFixedStatsV226/migrateJewelryApV207 recalculent bien ap/dp/hp/dodge/val
// à partir des reqAP/reqDP ACTUELS des zones, mais ne se relancent JAMAIS une fois passées (gate à
// usage unique par compte) -- les changements de reqAP/reqDP de zones de cette session (V234 :
// Trent/Iliya/Bashim échelonnées ; V235 : Kratuga/Planque des Mânes lissées) ne se répercutaient
// donc PAS sur le stuff déjà possédé avant ces changements. Relance simplement les 2 migrations
// existantes (mêmes formules, jamais dupliquées) pour rattraper tout le monde une fois de plus.
// À REFAIRE (nouveau flag S.migratedGearRescaleVxxx) à chaque future modification de reqAP/reqDP/
// gearBasisAP/DP d'une zone, sans quoi le stuff déjà dropé reste sur l'ancien calcul pour toujours.
/** Migration rétroactive V235 : relance migrateGearFixedStatsV226()+migrateJewelryApV207() (mêmes formules) pour rattraper les changements de reqAP/reqDP de zones survenus depuis leur premier passage. */
function migrateGearRescaleV235() {
  migrateGearFixedStatsV226();
  migrateJewelryApV207();
}
// migration 2026-07-12 (demande explicite : "fais en sorte que la mine de fer abandonné pass en
// zone difficile...") : Colonie Sausan a reçu un gearBasisDP dédié (45, au lieu du reqDP:37 utilisé
// par défaut) -- comme à chaque changement de reqAP/reqDP/gearBasisAP/DP de zone (voir
// migrateGearRescaleV235 ci-dessus), le stuff déjà dropé de cette zone AVANT ce changement doit être
// rattrapé. Nouveau flag dédié plutôt que réutiliser migratedGearRescaleV235 (déjà consommé par les
// comptes qui ont chargé une sauvegarde depuis le 2026-07-11).
/** Migration rétroactive V243 : relance les mêmes formules que V235, pour le rééquilibrage gearBasisDP de Colonie Sausan. */
function migrateGearRescaleV243() {
  migrateGearFixedStatsV226();
  migrateJewelryApV207();
}
// migration 2026-07-12 (demande explicite : "change les ap requis a partir de la zone verte") --
// les 4 zones du palier vert (Mine de Fer/Poste Helm/Repaire Bandits Gahaz/Base de Bashim) ont vu
// leur reqAP/reqDP abaissés ×0.80 -- comme à chaque changement de reqAP/reqDP/gearBasisAP/DP de
// zone (voir les migrations ci-dessus), le stuff déjà dropé de ces 4 zones doit être rattrapé.
/** Migration rétroactive V245 : relance les mêmes formules que V235, pour l'abaissement ×0.80 des reqAP/reqDP du palier vert. */
function migrateGearRescaleV245() {
  migrateGearFixedStatsV226();
  migrateJewelryApV207();
}
// migration 2026-07-23 (bug trouvé : joueurs au même palier PEN avec des PD différents sur des
// pièces au nom pourtant identique, ex: Casque Grunil 31 chez l'un, 53 chez l'autre) -- 3
// rééquilibrages de zone ont modifié reqDP APRÈS le dernier passage de rattrapage (V245) SANS
// jamais relancer migrateGearFixedStatsV226()/migrateJewelryApV207() : Sanctuaire d'Elric (V267,
// reqDP 91->101, palier Vert/casque du palier suivant selon la zone), Ruines de Kratuga (V282,
// reqDP abaissé, palier Bleu/armure) et Planque des Mânes (V286, reqDP abaissé, palier Bleu/gants).
// Ces 3 zones n'ont pas de gearBasisDP dédié : basisDP = reqDP directement (voir rollGearDrop),
// donc tout changement de reqDP change aussi silencieusement la puissance du stuff qui en drope --
// exactement le piège documenté juste au-dessus ("À REFAIRE... sans quoi le stuff déjà dropé reste
// sur l'ancien calcul pour toujours"), pas fait pour ces 3 versions. Relance simplement les 2
// migrations existantes (mêmes formules que V235/V243/V245, jamais dupliquées) pour TOUTE pièce de
// stuff déjà possédée (armes, armure, bijoux) -- pas seulement les 3 zones identifiées : capture
// aussi tout autre écart accumulé depuis V245 sans qu'on ait eu besoin de l'identifier zone par zone.
/** Migration rétroactive V403 : relance migrateGearFixedStatsV226()+migrateJewelryApV207() pour rattraper Sanctuaire d'Elric (V267), Ruines de Kratuga (V282) et Planque des Mânes (V286) -- changements de reqDP jamais répercutés sur le stuff déjà possédé, plus tout autre écart accumulé depuis V245. */
function migrateGearRescaleV403() {
  migrateGearFixedStatsV226();
  migrateJewelryApV207();
}
// le classement (S.bestGearscore/S.bestAp/S.bestDp) est un record À VIE qui ne redescend JAMAIS
// (voir hud(), core/game-core.js : `if (dpNow > S.bestDp) S.bestDp = dpNow`) -- la correction
// V403 ci-dessus ne se serait donc JAMAIS reflétée sur le classement pour les pièces NERFÉES
// (Kratuga/Mânes), même une fois le stuff lui-même corrigé (demande explicite du 2026-07-23 :
// "tout les items doivent donner le chiffre... rétroactivement... je veux que le classement soit
// mis à jour"). Nouveau flag dédié plutôt que modifier migrateGearRescaleV403 déjà livré (des
// comptes ont pu charger entre-temps et consommer son gate à usage unique -- même précaution que
// pour toute migration déjà en production, voir CLAUDE.md §12 pour les migrations SQL, même esprit
// ici). Exception volontaire et ponctuelle à la règle "jamais de régression", uniquement pour cette
// correction de bug : recalcule les 3 records depuis le stuff RÉELLEMENT équipé maintenant (déjà
// corrigé par migrateGearRescaleV403 juste avant dans applySaveState), puis pousse immédiatement
// le résultat au classement (syncPlayerStats(), même idiome que le commentaire "propage
// immédiatement au classement, sans attendre la prochaine synchro" de game-supabase.js) au lieu
// d'attendre la prochaine sauvegarde périodique.
/** Migration rétroactive V405 : recalcule les records de classement (bestGearscore/bestAp/bestDp) depuis le stuff équipé (déjà corrigé par migrateGearRescaleV403), y compris à la baisse, puis synchronise immédiatement (syncPlayerStats()). */
function migrateGearLeaderboardRecordFixV405() {
  if (typeof GS === 'function') S.bestGearscore = GS();
  if (typeof apEff === 'function') S.bestAp = apEff();
  if (typeof totalDP === 'function') S.bestDp = totalDP();
  if (typeof syncPlayerStats === 'function') syncPlayerStats();
}
// migration 2026-07-11 (bug corrigé : "aucune pierre ne se met dans le slot pour les bijoux") --
// les bijoux (jackpot) n'ont jamais eu de matName depuis leur introduction (voir rollDrops,
// corrigé juste au-dessus) : findEnhanceMaterial() retombait donc sur le matériau de la zone
// COURANTE au lieu de celui du PALIER du bijou lui-même. Backfill pour tout bijou déjà possédé
// (équipé/sac/protégé), à partir de SA PROPRE zone d'origine (JACKPOT_NAME_TO_ZONE, jamais celle
// où l'on farme actuellement).
/** Migration rétroactive V239 : backfill matName sur tout bijou déjà possédé, depuis sa zone d'origine (JACKPOT_NAME_TO_ZONE) — corrige findEnhanceMaterial() qui retombait sur le matériau de la zone courante. */
function migrateJewelryMatNameV239() {
  const fix = it => {
    if (!it || it.kind !== 'jackpot' || it.matName) return;
    const zi = JACKPOT_NAME_TO_ZONE[it.name];
    if (zi == null) return;
    it.matName = gearTierForZone(zi).material.name;
  };
  Object.values(EQUIP).forEach(fix);
  INV.forEach(fix);
  COMPENDIUM_BAG.forEach(fix);
}
// migration 2026-07-08 (bug trouvé : "Regarde le compendium retroactivement des objet PEN") --
// la Maîtrise PEN (S.penMastery, voir markPenMastery dans core/game-core.js) n'existe que depuis
// le 2026-07-08 et ne s'enregistre QUE sur un enchantement RÉUSSI vers PEN après cette date. Un
// joueur qui avait déjà un objet à PEN AVANT cette date (equipé, en sac, ou dans le Compendium
// protégé) ne le verrait donc jamais compté, sans backfill. Contrairement à markPenMastery(),
// écrit directement dans S.penMastery : pas de floatTxt/log Discord pour chaque objet (spam au
// premier chargement), un simple rattrapage silencieux de l'état déjà acquis.
/**
 * Migration rétroactive : rattrape S.penMastery pour tout objet déjà à PEN AVANT le 2026-07-08
 * (voir contexte complet juste au-dessus). Pattern de référence pour toute nouvelle migration
 * rétroactive de ce fichier (CLAUDE.md §13) : écrit DIRECTEMENT dans la structure de données,
 * jamais via les fonctions "normales" (markPenMastery) qui logueraient/notifieraient à tort.
 * Gatée par S.migratedPenMasteryV308 dans applySaveState() (core/game-core.js) — exécution unique.
 * @returns {void} mute S.penMastery et COMPENDIUM_BAG en place, aucune valeur de retour.
 */
function migratePenMasteryV308() {
  const maxLvl = ENH_NAMES.length - 1;
  const check = it => {
    if (!it || !it.optimizable || (it.enhLv||0) < maxLvl) return;
    S.penMastery[it.name] = true;
  };
  Object.values(EQUIP).forEach(check);
  INV.forEach(check);
  COMPENDIUM_BAG.forEach(check);
  // rattrapage rétroactif (2026-07-08, demande explicite : "supprime l'item non pen du sac
  // protégé... rétroactif") -- une fois S.penMastery rempli ci-dessus (y compris pour des noms
  // marqués maîtrisés seulement AUJOURD'HUI par ce backfill), toute copie encore protégée dans
  // COMPENDIUM_BAG pour un nom désormais maîtrisé n'a plus lieu d'y être : voir
  // evictMasteredFromCompendiumBag (core/game-core.js), même fonction que celle appelée en jeu
  // à chaque enchantement réussi vers PEN -- ici on la rejoue simplement pour tout l'historique.
  new Set(COMPENDIUM_BAG.filter(Boolean).map(it => it.name)).forEach(evictMasteredFromCompendiumBag);
}
