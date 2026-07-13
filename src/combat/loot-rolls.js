// ==================== GENERATION DU LOOT & GAIN D'XP ====================
// Extrait de game-core.js le 2026-07-08 (reorganisation par dossiers) -- DOIT charger APRES
// core/game-core.js (S, EQUIP, INV, floats, GEAR_TIERS...), progression/notifications-quests.js
// (pushNotif) : tout est reference en execution (function bodies), aucune evaluation immediate.
// prix de revente du gear looté (2026-07-09, demande explicite : "les item looté doivent se vendre
// bien moins chere" -- le trash au sol doit rester la SOURCE PRINCIPALE de revenu, pas la revente de
// pièces d'équipement/bijoux). Multiplicateur divisé par 10 (était 22) -- ex: un plastron de zone10
// valait 8228 silver (×78 le trash de la même zone, 105) contre ~823 désormais (×~8), toujours
// notable mais clairement secondaire au farm de trash.
const GEAR_SELL_MULT = 2.2;
// ratio bijou/trash (2026-07-09) — voir le commentaire complet dans rollDrops. Scope module (pas
// local à rollDrops) pour être réutilisable par migrateGearFixedStatsV226 (rétroactivité).
const JACKPOT_VAL_TRASH_RATIO = 20;
// taux de drop (chance) d'un groupe ALPHA (boss de pack) : uniformément ×2 par rapport au taux
// normal (2026-07-11, demande explicite : "les groupe alpha (boss) drop x2 par rapport au taux de
// loot") -- remplace les anciens multiplicateurs disparates (×1.5 trash/mat/jackpot/craft, ×1.6
// gear/arme). Ne touche PAS au multiplicateur de VALEUR silver (×1.6, inchangé, un concept séparé
// du taux de drop).
const ALPHA_LOOT_CHANCE_MULT = 2;
/**
 * Tire (ou non) la pièce d'armure garantie de la zone (voir ZONE_ARMOR_SLOTS). Stats FIXES
 * (aucun jet aléatoire, 2026-07-09) — dérivées de gearBasisAP/DP de la zone et du rôle du slot,
 * jamais de la puissance de combat aléatoire.
 * @param {object} zone - entrée de ZONES (lit gearBasisAP/DP ?? reqAP/reqDP, sets[slot]...).
 * @param {boolean} alpha - vrai si c'est un pack alpha (boss de pack) : chance ×ALPHA_LOOT_CHANCE_MULT.
 * @returns {object|null} un item gear complet (voir la forme retournée) ou null si le jet échoue.
 */
function rollGearDrop(zone, alpha) {
  const tier = gearTierForZone(zoneIdx);
  const chance = gearDropChance(tier, zoneIdx);
  if (Math.random() > chance * (alpha ? ALPHA_LOOT_CHANCE_MULT : 1)) return null;
  // 1 seule pièce d'armure garantie par zone (2026-07-06, demande explicite), voir ZONE_ARMOR_SLOTS
  // -- remplace l'ancien tirage au hasard parmi les 4 pièces, partagé entre les 4 zones du palier
  const slot = (ZONE_ARMOR_SLOTS[zoneIdx] || GEAR_SLOTS)[0];
  const role = GEAR_ROLE[slot];
  // gearBasisAP/DP (2026-07-08) : la PUISSANCE du stuff loot ici peut différer du reqAP/reqDP de
  // COMBAT de la zone (ex: Camp des Loups, volontairement facile mais dont le stuff doit préparer
  // à la zone suivante) — repli sur reqAP/reqDP si la zone n'a pas de gearBasis dédié
  const basisAP = zone.gearBasisAP ?? zone.reqAP, basisDP = zone.gearBasisDP ?? zone.reqDP;
  // stats FIXES, aucun jet aléatoire (2026-07-09, demande explicite : "Aucuns jet aléatoire sur les
  // objet équipable, ils donnent des statisque fix") -- avant, un ±15% (0.85-1.15) rendait 2
  // exemplaires du même objet différents sans raison ; désormais toujours la même valeur pour un
  // même palier/slot/zone, seul l'enchantement (enhLv) fait ensuite varier la puissance réelle.
  const ap = role.apShare ? gearFloor(basisAP * role.apShare) : 0;
  const dp = role.dpShare ? gearFloor(basisDP * role.dpShare) : 0;
  const hp = role.hpShare ? gearFloor(basisDP * role.hpShare * HP_GEAR_SCALE) : 0;
  const dodge = Math.round(basisDP * (role.dodgeShare||0) * DODGE_GEAR_SCALE * 100) / 100;
  // toute pièce d'armure prend la couleur ET l'ornementation du palier (icône générée à la volée,
  // 2026-07-07 puis étendu au casque + ornements de rareté le 2026-07-08)
  const TIER_COLORED_ICON = { helmet: helmetIconForColor, armor: armorIconForColor, gloves: glovesIconForColor, boots: bootsIconForColor };
  const icon = TIER_COLORED_ICON[slot] ? TIER_COLORED_ICON[slot](tier.color, tier.grade) : (SLOT_ICON ? SLOT_ICON[slot] : '⚔️');
  return {
    name: tier.sets[slot], kind:'gear', slot, ap, dp, hp, dodge, enhLv:0, optimizable:true, fsByLevel:{},
    key:'gear_'+tier.grade+'_'+slot+'_'+Math.random().toString(36).slice(2,7),
    icon, color:tier.color, stackable:false, weight:1.2,
    matName: tier.material.name, // matériau requis pour optimiser CETTE pièce (voir findEnhanceMaterial)
    val: Math.round((ap*2 + dp + hp*0.5) * GEAR_SELL_MULT),
  };
}
// arme(s) garantie(s) de la zone (2026-07-05, demande explicite : "1 arme dans chaque zone") —
// remplace l'ancien tirage au hasard partagé avec l'armure : chaque zone a un jet INDÉPENDANT (même
// taux que l'armure) pour son ou ses types d'arme désignés (voir ZONE_WEAPON_SLOTS). Renvoie un
// tableau (0, 1 ou 2 armes selon la zone et la chance).
/**
 * Tire la ou les armes garanties de la zone (voir ZONE_WEAPON_SLOTS) — jet INDÉPENDANT du drop
 * d'armure, même taux de base. Comme rollGearDrop(), stats fixes par palier/slot/zone.
 * @param {object} zone - entrée de ZONES.
 * @param {boolean} alpha - vrai si pack alpha : chance ×ALPHA_LOOT_CHANCE_MULT.
 * @returns {object[]} tableau de 0, 1 ou 2 items arme selon la zone et le jet.
 */
function rollWeaponDrop(zone, alpha) {
  const tier = gearTierForZone(zoneIdx);
  const chance = gearDropChance(tier, zoneIdx);
  const slots = ZONE_WEAPON_SLOTS[zoneIdx] || ['weapon'];
  // arme/dague/orbes d'éveil prennent aussi la couleur ET l'ornementation du palier (2026-07-08,
  // même traitement que l'armure — voir staffIconForColor/daggerIconForColor/orbPairIconForColor)
  const TIER_COLORED_ICON = { weapon: staffIconForColor, secondary: daggerIconForColor, awakening: orbPairIconForColor };
  const out = [];
  for (const slot of slots) {
    if (Math.random() > chance * (alpha ? ALPHA_LOOT_CHANCE_MULT : 1)) continue;
    const role = GEAR_ROLE[slot];
    // stat FIXE, aucun jet aléatoire (2026-07-09, demande explicite) — voir rollGearDrop
    const basisAP = zone.gearBasisAP ?? zone.reqAP;
    const ap = gearFloor(basisAP * role.apShare);
    out.push({
      name: tier.sets[slot], kind:'gear', slot, ap, dp:0, hp:0, dodge:0, enhLv:0, optimizable:true, fsByLevel:{},
      key:'gear_'+tier.grade+'_'+slot+'_'+Math.random().toString(36).slice(2,7),
      icon: TIER_COLORED_ICON[slot] ? TIER_COLORED_ICON[slot](tier.color, tier.grade) : (SLOT_ICON ? SLOT_ICON[slot] : '⚔️'),
      color:tier.color, stackable:false, weight:1.2,
      matName: tier.material.name,
      val: Math.round(ap*2 * GEAR_SELL_MULT),
    });
  }
  return out;
}

// Trésor de Velia — objets de production à part entière (2026-07-13 : sorti du statut
// expérimental "TEST", demande explicite), identique dans TOUTES les zones du jeu (pas de scaling
// par zone/palier pour la CHANCE de drop — le PRIX, lui, suit le palier courant, voir referenceGearVal).
// Trésor de Velia 1/2/3 fusionnés en un seul "Trésor de Velia" (2026-07-13, demande explicite :
// "tout les tresors de velia 1/2/3 s'appel maintenant tresors de velia") -- avant, 3 variantes
// distinctes servaient d'ingrédients pour un objet mystère (voir historique de craftMysteryItem,
// retiré : il fallait pouvoir empiler 3 exemplaires, impossible désormais que le Trésor plafonne à
// 1 en sac, voir TREASURE_STACK_CAP).
// VELIA_TREASURE/treasureTotal/referenceGearVal/TREASURE_STACK_CAP/enforceTreasureStackCap/
// TREASURE_PIECE_RECIPES/invSlotByKey/invQtyByKey/invHasRoomFor/craftTreasurePiece/
// secretComboReady/craftSecretCombo/renderTreasureCraftPanel desormais dans
// progression/treasure-craft.js (extrait le 2026-07-08, reorganisation par dossiers) --
// charge APRES ce fichier, voir index.html.
// affiche un % avec juste assez de décimales pour rester lisible même sur des chances minuscules
// (ex: 0.00001%) — toFixed(1) fixe habituel afficherait juste "0.0%"
/** @param {number} ch - chance en fraction (0-1). @returns {string} pourcentage avec assez de décimales pour rester lisible même à 0.00001%. */
function fmtTinyPct(ch) {
  const pct = ch * 100;
  if (pct <= 0) return '0%';
  const decimals = Math.min(8, Math.max(1, Math.ceil(-Math.log10(pct)) + 1));
  return pct.toFixed(decimals) + '%';
}
// rythme de kills/min de référence pour évaluer le temps moyen d'obtention des trésors côté admin
// (voir panneau admin > Trésor de Velia) — comparable au "Kills/min" affiché en jeu (stKpm)
const ADMIN_TREASURE_KPM_REF = 15;
/** @param {number} min - durée en minutes. @returns {string} min/h/j, formaté selon la grandeur (panneau admin Trésor de Velia). */
function fmtDurationMin(min) {
  if (min < 60) return Math.round(min) + ' min';
  const hours = min / 60;
  if (hours < 24) return hours.toFixed(1) + ' h';
  return (hours/24).toFixed(1) + ' j';
}
/**
 * Génère tout le loot d'un kill (trash, matériau, bijou rare, composant de craft, + rollGearDrop/
 * rollWeaponDrop pour les packs qui en portent) — le cœur de la boucle de combat côté récompenses.
 * @param {object} wp - pack de monstres tué (weightedPack), fournit son propre alpha/composition.
 * @param {boolean} alpha - vrai si pack alpha (boss de pack) : ×ALPHA_LOOT_CHANCE_MULT sur les
 *   chances de drop (jamais sur la valeur silver, voir JACKPOT_VAL_TRASH_RATIO/GEAR_SELL_MULT).
 * @param {number} lm - multiplicateur de loot courant (buffs actifs, potions...).
 * @returns {void} pousse directement dans INV/S (silver) et déclenche les floatTxt/notifications.
 */
function rollDrops(wp, alpha, lm) {
  const zone = Z(), L = zone.loot;
  const zk = zoneIdx; // pour rendre les clés uniques par zone
  const mults = alpha ? ALPHA_LOOT_CHANCE_MULT : 1;
  // le matériau d'optimisation dépend désormais du PALIER de stuff (Naru/Tuvala/Yuria/Grunil),
  // pas de la zone — on garde juste la valeur/chance d'origine de la zone (économie inchangée)
  const tier = gearTierForZone(zoneIdx);
  const tierMat = tier.material;
  // bijou (jackpot) : icône générée selon le palier — anneau nu (gris/blanc) → un diamant (vert) →
  // plusieurs diamants + couleur du palier (bleu) — demande explicite du 2026-07-07
  const jSlot = accSlotFor(L.jackpot);
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const jackpotIcon = (JEWEL_ICON_FOR_SLOT[jSlot] || ringIconForTier)(jTierIdx, tier.color);
  // AP du bijou calculé dynamiquement depuis reqAP/gearBasisAP de la zone (2026-07-08, demande
  // explicite : "revois ce que donne le stuff et aligne avec toute les autre stuff") — remplace
  // l'ancienne valeur FIGÉE (L.jackpot.ap dans ZONES), jamais recalculée après un changement de
  // reqAP et donc désynchronisée du reste du stuff, qui a toujours scalé dynamiquement
  const jackpotAp = gearFloor((zone.gearBasisAP ?? zone.reqAP) * GEAR_ROLE.jackpot.apShare);
  // valeur de revente du bijou (2026-07-09, demande explicite : "les item looté doivent se vendre
  // bien moins chere") -- remplace l'ancienne valeur FIGÉE de ZONES (L.jackpot.val), qui valait
  // ~180 à ~290× le trash de sa propre zone (ex: 35 000 contre 120 en zone 11) : le bijou éclipsait
  // totalement le trash comme source de revenu. Recalculée dynamiquement à ~20× le trash de la
  // zone, un vrai bonus notable au dropped mais qui ne concurrence plus le farm de trash.
  // (constante en scope MODULE, pas locale — réutilisée par migrateGearFixedStatsV226 pour
  // recalculer rétroactivement le stuff déjà possédé, voir plus bas)
  const jackpotVal = gearFloor(L.trash.val * JACKPOT_VAL_TRASH_RATIO);
  const table = [
    { ...L.trash,   kind:'trash',    color:'#a08464', key:'trash_'+zk,   icon:'▬', stackable:true,  weight:0.3 },
    { name:tierMat.name, val:L.mat.val, ch:L.mat.ch, kind:'material', color:tierMat.color, key:'mat_'+tierMat.name, icon:tierMat.icon, stackable:true, weight:0.1 },
    // matName (2026-07-11, bug corrigé : "aucune pierre ne se met dans le slot pour les bijoux") --
    // manquait sur les bijoux (jackpot), contrairement au gear/armes qui l'ont toujours eu ; sans
    // lui, findEnhanceMaterial() retombait sur le matériau de la zone COURANTE au lieu de celui du
    // PALIER du bijou ciblé, cassant l'auto-sélection dès que le bijou équipé n'était pas du même
    // palier que la zone où l'on farme actuellement (voir tier.material, même valeur que pour
    // l'armure/les armes de ce palier).
    { ...L.jackpot, ch:jewelDropChance(tier, L.jackpot.ch), ap:jackpotAp, val:jackpotVal, kind:'jackpot',  color:tier.color, key:'acc_'+zk+'_'+Math.random().toString(36).slice(2,7), icon:jackpotIcon, stackable:false, weight:0.5, matName:tierMat.name },
    { ...L.craft,   kind:'craft',    color:'#b48ce8', key:'craft_'+L.craft.name, icon:'✦', stackable:true, weight:0.2, val:0 },
    // "Bout du trésor de Velia" se loot par 1 à 3 (demande explicite du 2026-07-06) -- pickupQty
    // DOIT être tiré ici (dans ce tableau reconstruit à chaque kill), jamais dans la définition
    // statique de VELIA_TREASURE (const de module, évaluée UNE SEULE fois au chargement du script :
    // un Math.random() y serait figé pour toute la session au lieu d'être retiré à chaque drop)
    // val (2026-07-13, demande explicite) : "Bout" = 10× le prix d'un équipement de CE palier,
    // "Trésor de Velia" = 10 000× -- voir referenceGearVal (ignoré par le multiplicateur alpha/lm
    // habituel juste en dessous, ce n'est pas un revenu de trash mais un prix de vente fixe)
    ...VELIA_TREASURE.map(t => ({ name:t.name, val:referenceGearVal()*(t.key==='treasure_bout_velia'?10:10000), ch:t.ch, kind:'treasure', color:t.color, key:t.key, icon:t.icon, stackable:true, weight:0.05,
      pickupQty: t.key==='treasure_bout_velia' ? 1+Math.floor(Math.random()*3) : 1 })),
    // Sceau du Conclave des Marchands — fragment de Velia (2026-07-13) : SEUL fragment obtenable
    // aujourd'hui (les 4 autres régions restent verrouillées, voir conclaveSealFragmentUnlocked),
    // drop rare identique dans TOUTES les zones du jeu (même principe que VELIA_TREASURE juste
    // au-dessus, pas de scaling par zone). Chance calibrée entre "Bout du trésor de Velia" (0.17%,
    // fréquent) et "Trésor de Velia" (0.0005%, quasi jamais) : cet objet débloque un bonus Marché
    // permanent et cumulatif avec un futur assemblage, un cran plus rare qu'un bijou de zone
    // classique (~0.1-0.6%) mais pas aussi exceptionnel que le Trésor complet.
    ...CONCLAVE_SEAL_FRAGMENTS.filter(f => conclaveSealFragmentUnlocked(f.tierId)).map(f => ({
      name:f.name, val:referenceGearVal()*50, ch:CONCLAVE_SEAL_DROP_CH, kind:'treasure', color:f.color, key:f.key, icon:f.icon, stackable:false, weight:0.05, pickupQty:1,
    })),
    // Pierre de Cron : taux FIXE (voir CRON_STONE.ch), identique dans TOUTES les zones du jeu
    // (indépendante du palier de stuff). 1 à 3 unités par drop (pickupQty).
    { name:CRON_STONE.name, val:0, ch:CRON_STONE.ch, kind:'material', color:CRON_STONE.color, key:CRON_STONE.key,
      icon:CRON_STONE.icon, stackable:true, weight:0.1, pickupQty: 1+Math.floor(Math.random()*3) },
  ];
  for (const item of table) {
    if (Math.random() > item.ch * mults) continue;
    const a = Math.random()*Math.PI*2, r = 14+Math.random()*46;
    drops.push({
      x: wp.x + Math.cos(a)*r, y: wp.y + Math.sin(a)*r,
      item, taken:false,
      // valeur FIXE par zone × lootMult(r) — plus aucun scaling au niveau joueur ; le Trésor de
      // Velia échappe à ce multiplicateur (2026-07-13) : son prix est déjà un multiple fixe du
      // prix d'un équipement (voir referenceGearVal ci-dessus), pas un revenu de trash à booster
      silver: item.kind === 'treasure' ? item.val : Math.ceil((item.val||0) * (alpha?1.6:1) * lm),
      age:0, pop:.35,
    });
  }
  const gear = rollGearDrop(zone, alpha);
  if (gear) {
    const a = Math.random()*Math.PI*2, r = 14+Math.random()*46;
    drops.push({ x: wp.x+Math.cos(a)*r, y: wp.y+Math.sin(a)*r, item: gear, taken:false, silver: gear.val, age:0, pop:.35 });
  }
  // arme(s) garantie(s) de la zone (2026-07-05) — voir rollWeaponDrop/ZONE_WEAPON_SLOTS
  for (const weapon of rollWeaponDrop(zone, alpha)) {
    const a = Math.random()*Math.PI*2, r = 14+Math.random()*46;
    drops.push({ x: wp.x+Math.cos(a)*r, y: wp.y+Math.sin(a)*r, item: weapon, taken:false, silver: weapon.val, age:0, pop:.35 });
  }
}

const DESPAWN = 40;
let invFullWarned = 0;
let lastInvFullToast = 0;
/** Affiche le bandeau "sac plein" et un toast (au plus 1/4s pour ne pas spammer) quand un drop ne peut pas être ramassé. */
function showInvFullWarning() {
  invFullWarned = 2;
  const el = $('invFullBanner');
  if (!el) return;
  el.classList.add('show');
  const now = performance.now();
  if (now - lastInvFullToast > 4000) { // pas plus d'1 toast/4s pour ne pas spammer
    lastInvFullToast = now;
    floatTxt(P.x, P.y-20, 70, i18next.t('combat:combat.loot.bag_full'), {hurt:true});
  }
}
/**
 * Tick des drops au sol : fait vieillir/dépop chaque drop, ramasse ceux à portée du joueur
 * (trash en silver direct, le reste via invAdd — reste au sol si le sac est plein), déclenche
 * loot ticker/floatTxt/tutoriels d'objet/logs Discord selon le kind, puis purge les drops pris
 * ou expirés (DESPAWN).
 * @param {number} dt - delta-temps de la frame, en secondes.
 */
function dropsTick(dt) {
  for (const l of drops) {
    if (l.taken) continue;
    l.age += dt; l.pop = Math.max(0,l.pop-dt);
    if (P.faint <= 0 && dist(P.x,P.y,l.x,l.y) < S.lootRadius) {
      const it = l.item;

      // le trash est du silver pur : toujours ramassé, ne prend jamais de place dans le sac
      if (it.kind === 'trash') {
        addSilver(l.silver, 'loot', it.name);
        l.taken = true; S.lootCount++;
        lootLine(it, l.silver, 'trashLoot');
        floatTxt(l.x,l.y,40,it.name,{silver:true});
        particles.push({ type:'pickup', x:l.x, y:l.y, life:.35, max:.35, color:it.color });
        queueFarmEvent(it.kind, it.name, 1, l.silver);
        const zoneWasDone = zoneFullyCollected(zoneIdx); // Compendium : avant ramassage
        trackLoot(it.name, it.color, l.silver, it.kind);
        checkZoneCompendiumUnlock(zoneIdx, zoneWasDone);
        // tutoriel d'objet au tout premier trash ramassé, toutes zones confondues (2026-07-19) --
        // voir ITEM_TUTORIALS.trash/maybeQueueItemTutorial (progression/notifications-quests.js)
        if (typeof maybeQueueItemTutorial === 'function') maybeQueueItemTutorial(it.name);
        continue;
      }

      // construit l'objet inventaire (matériau/bijou/gear/craft — ceux-là prennent une place)
      const isOptimizable = it.kind === 'gear' || it.kind === 'jackpot';
      const obj = {
        // le bijou porte déjà sa propre icône (générée selon son palier au moment du drop, voir
        // rollDrops) — ne plus l'écraser par l'ancienne icône générique JACKPOT_ICON
        key: it.key, name: it.name, kind: it.kind, icon: it.icon, color: it.color,
        qty: it.pickupQty || 1, stackable: it.stackable, weight: it.weight,
        val: l.silver, ap: it.ap||0, dp: it.dp||0, hp: it.hp||0, dodge: it.dodge||0, enhLv: it.enhLv||0,
        optimizable: isOptimizable, fsByLevel: isOptimizable ? {} : undefined,
        slot: it.kind==='jackpot' ? accSlotFor(it) : it.kind==='gear' ? it.slot : null,
        matName: it.matName, // palier de stuff (Naru/Tuvala/Yuria/Grunil) → quel matériau l'optimise
      };
      const ok = invAdd(obj);
      if (!ok) { // inventaire plein → l'objet reste au sol (le joueur continue de farmer normalement)
        showInvFullWarning();
        continue;
      }
      l.taken = true;
      S.lootCount++;
      queueFarmEvent(it.kind, it.name, 1, l.silver);
      const zoneWasDone = zoneFullyCollected(zoneIdx); // Compendium : avant ramassage
      trackLoot(it.name, it.color, l.silver, it.kind);
      checkZoneCompendiumUnlock(zoneIdx, zoneWasDone);
      if (it.kind === 'jackpot') {
        S.jackpotCount = (S.jackpotCount||0) + 1;
        // prix affiché uniquement pour le trash/token (2026-07-15, demande explicite : "affiche pas
        // le prix sur les item autre que token met juste la quantité") -- avant, le ticker montrait
        // "(+1234)" pour n'importe quel objet vendable au ramassage, pas seulement le trash
        lootLine(it, 0, 'jackpot');
        floatTxt(l.x,l.y,55,'★ '+it.name,{lvl:true});
        // le centre de notifications ne garde que les infos importantes (succès, boss, niveau) —
        // les trouvailles de loot restent visibles dans le loot ticker, pas besoin de les dupliquer
        // ici (demande explicite du 2026-07-06)
        logToDiscord('💍 Bijou rare trouvé', `**${myPseudo||'Joueur'}** a trouvé ${it.name}`, 0xb48ce8);
      } else if (it.kind === 'gear') {
        S.gearDropCount = (S.gearDropCount||0) + 1;
        lootLine(it, 0, 'jackpot');
        floatTxt(l.x,l.y,55,'⚔ '+it.name,{lvl:true});
        logToDiscord('⚔️ Équipement rare trouvé', `**${myPseudo||'Joueur'}** a trouvé ${it.name}`, 0xb48ce8);
      } else if (it.kind === 'craft') {
        lootLine(it, 0, 'rare');
        floatTxt(l.x,l.y,40,it.name,{blue:true});
        // tutoriel d'objet au premier ramassage (2026-07-19) : Poussière d'esprit ancien/Fragment de
        // mémoire/Marbre du Dieu déchu -- voir ITEM_TUTORIALS/maybeQueueItemTutorial (progression/
        // notifications-quests.js). Fonction pure de décision, gère elle-même le flag "déjà vu" et
        // la file d'attente -- rien à vérifier ici, simple point d'accroche au ramassage.
        if (typeof maybeQueueItemTutorial === 'function') maybeQueueItemTutorial(it.name);
      } else if (it.kind === 'treasure') {
        lootLine(it, 0, 'rare');
        floatTxt(l.x,l.y,50,'🗺️ '+it.name,{lvl:true});
        // les trésors sont TRÈS rares (jusqu'à 0.00001% de chance) — vaut bien un log "pour le fun"
        logToDiscord('🗺️ Trésor de Velia', `**${myPseudo||'Joueur'}** trouve ${it.name} (${fmtTinyPct(it.ch)} de chance)`, 0xe8c96a);
      } else {
        lootLine(it, 0, it.kind === 'material' ? 'matLoot' : '');
        floatTxt(l.x,l.y,40,it.name,{silver:true});
        // tout premier ramassage d'une Pierre de Cron (2026-07-09, demande explicite) : petit
        // tutoriel expliquant son rôle (protège contre une rétrogradation, activable/désactivable
        // en cliquant dessus) — voir CRON_TUTORIAL_STEPS/startCronTutorial (game-supabase.js)
        if (it.name === CRON_STONE.name && !cronTutoSeen) {
          cronTutoSeen = true;
          try { localStorage.setItem('velia-idle-cron-tuto-seen', '1'); } catch(e) {}
          setTimeout(startCronTutorial, 400);
        }
        // tutoriel d'objet au premier ramassage (2026-07-19) : Pierre de Novice/du Temps/Noire/
        // concentrée (les 4 matériaux d'optimisation par palier, kind:'material') -- voir
        // ITEM_TUTORIALS/maybeQueueItemTutorial (progression/notifications-quests.js). N'a aucun
        // effet sur la Pierre de Cron (pas dans ITEM_TUTORIAL_BY_NAME, déjà son propre tutoriel
        // ci-dessus) ni sur les autres objets non enregistrés dans ITEM_TUTORIALS.
        else if (it.kind === 'material' && typeof maybeQueueItemTutorial === 'function') maybeQueueItemTutorial(it.name);
      }
      particles.push({ type:'pickup', x:l.x, y:l.y, life:.35, max:.35, color:it.color });
      if (invPanelOpen) renderInventory();
    }
  }
  drops = drops.filter(l => !l.taken && l.age < DESPAWN);
}

// attribue un slot d'accessoire probable selon le nom
/** @param {object} it - item jackpot (lit it.name). @returns {'ring'|'necklace'|'earring'|'belt'} slot d'accessoire déduit du nom (repli 'ring' si aucun mot-clé). */
function accSlotFor(it) {
  const n = it.name.toLowerCase();
  // "earring" contient la sous-chaîne "ring" → on le teste EN PREMIER pour ne pas le confondre avec une bague
  if (n.includes('earring') || n.includes('boucle') || n.includes('oreille')) return 'earring';
  if (n.includes('necklace') || n.includes('collier')) return 'necklace';
  if (n.includes('belt') || n.includes('ceinture')) return 'belt';
  if (n.includes('ring') || n.includes('bague') || n.includes('anneau')) return 'ring';
  return 'ring'; // repli si aucun mot-clé ne matche
}

// regroupe les drops IDENTIQUES consécutifs en une seule ligne "xN" au lieu de spammer une
// ligne par ramassage — demande explicite du 2026-07-05
// prix affiché UNIQUEMENT pour le trash/token (2026-07-15, demande explicite : "affiche pas le prix
// sur les item autre que token met juste la quantité et met une icone quand c'est le prix pour le
// loot") -- seul le trash passe encore un val>0 (voir les appels de lootLine dans dropsTick), les
// autres kinds n'affichent plus que leur nom + ×N. Une pièce 🪙 précède le prix quand il est affiché.
// Quantité ×N placée AVANT le prix (2026-07-15, demande explicite : "dans le loot ticker mais la
// quantité avant le prix") -- était après.
/**
 * Ajoute une ligne au loot ticker, ou incrémente le compteur ×N de la dernière ligne si le
 * même item/classe se répète consécutivement (évite de spammer une ligne par ramassage).
 * @param {object} item - item ramassé (lit item.name).
 * @param {number} val - silver à afficher (0 = pas de prix affiché, juste le nom/quantité).
 * @param {string} cls - classe CSS de la ligne (style par kind de loot).
 */
function lootLine(item, val, cls) {
  const t = $('lootTicker');
  if (lastLootEntry && lastLootEntry.name === item.name && lastLootEntry.cls === (cls||'') && lastLootEntry.el.isConnected) {
    lastLootEntry.count++;
    lastLootEntry.val += val;
    lastLootEntry.el.innerHTML = `${escapeHtml(item.name)} ×${lastLootEntry.count}` + (lastLootEntry.val > 0 ? ` (🪙+${fmt(lastLootEntry.val)})` : '');
    return;
  }
  const div = document.createElement('div');
  if (cls) div.className = cls;
  div.innerHTML = val > 0 ? `${escapeHtml(item.name)} (🪙+${fmt(val)})` : escapeHtml(item.name);
  t.appendChild(div); // + flex-direction:column en CSS → apparaît en bas, pousse les anciennes vers le haut
  while (t.children.length > 15) t.removeChild(t.firstChild);
  lastLootEntry = { name:item.name, cls: cls||'', count:1, val, el:div };
}

// LEVEL_XP_TABLE desormais dans progression/level-xp-data.js (extrait le 2026-07-08,
// reorganisation par dossiers) -- charge AVANT ce fichier, voir index.html.
/**
 * XP totale requise pour passer du niveau `lvl` au suivant (table fixe, pas de formule —
 * LEVEL_XP_TABLE, progression/level-xp-data.js). Clampe au dernier palier défini si `lvl` le
 * dépasse (pas de niveau infini au-delà de la table).
 * @param {number} lvl - niveau actuel du joueur.
 * @returns {number} XP nécessaire pour ce palier.
 */
function xpNeededFor(lvl) { return LEVEL_XP_TABLE[Math.min(lvl, LEVEL_XP_TABLE.length-1)]; }
// affichage façon BDO : pourcentage à 3 décimales, toujours 2 chiffres avant la virgule (00.000%)
/** @param {number} pct - pourcentage d'XP (0-100). @returns {string} format BDO "00.000%" (2 chiffres + 3 décimales, clampé). */
function fmtXpPct(pct) {
  pct = Math.max(0, Math.min(99.999, pct));
  const [intPart, decPart] = pct.toFixed(3).split('.');
  return intPart.padStart(2,'0') + '.' + decPart + '%';
}
// s'illumine brièvement autour du niveau/XP à chaque gain (2026-07-10, demande explicite : "fais
// un carré autour du niveau et % d'xp qui s'illumine quand on gagne de l'xp")
/** Rejoue brièvement l'animation de flash CSS (xpFlash) autour du niveau/XP à chaque gain. */
function flashXpGain() {
  const el = $('lvlXpRow'); if (!el) return;
  el.classList.remove('xpFlash');
  void el.offsetWidth; // force reflow pour rejouer la transition CSS même si déjà en cours
  el.classList.add('xpFlash');
  clearTimeout(flashXpGain._t);
  flashXpGain._t = setTimeout(() => el.classList.remove('xpFlash'), 500);
}
/**
 * Ajoute `n` XP au joueur et gère le(s) passage(s) de niveau en cascade (une boucle `while`, pas
 * un `if` — un gros gain d'XP peut faire monter plusieurs niveaux d'un coup). Effets de bord :
 * HP max +8/niveau, floatTxt/notification à chaque niveau, tracking awayXpGained si l'onglet est
 * caché (résumé AFK au retour, voir showAwayLootSummaryIfAny), et cumul S.xpEarned (compteur À VIE,
 * ne redescend jamais contrairement à S.xp -- alimente bestXpPerHour/le rattrapage hors-ligne XP,
 * voir hud()/computeOfflineCatchupXp dans core/game-core.js).
 * @param {number} n - XP gagnée (peut être 0 ou négative selon l'appelant, seul n>0 déclenche le flash visuel).
 * @returns {void} mute S.xp/S.lvl/S.xpNext/S.hpMax/P.hp/S.xpEarned en place.
 */
function gainXp(n) {
  if (n > 0) flashXpGain();
  if (n > 0 && document.hidden) awayXpGained += n;
  if (n > 0) S.xpEarned = (S.xpEarned||0) + n;
  S.xp += n;
  while (S.xp >= S.xpNext) {
    S.xp -= S.xpNext; S.lvl++;
    S.xpNext = xpNeededFor(S.lvl);
    S.hpMax += 8; P.hp = effHpMax();
    floatTxt(P.x,P.y,115,'NIVEAU '+S.lvl,{lvl:true});
    pushNotif('⭐', i18next.t('combat:combat.loot.level_up_notif_title'), i18next.t('combat:combat.loot.level_reached', { lvl: S.lvl }), 'info');
    // log "pour le fun" (demande explicite du 2026-07-08 : "spam le channel, fais toi plaisir")
    logToDiscord('⭐ Niveau supérieur', `**${myPseudo||'Joueur'}** passe niveau **${S.lvl}** (SPD +${Math.round(levelSpdPct())}%)`, 0x9cc9e8);
    // onglet Statistiques > Niveaux (2026-07-15, demande explicite : "des qu'on prend un lvl les
    // info change en fonction") -- si l'onglet est déjà ouvert, le fait suivre le level-up en direct
    if (statsTab === 'levels') renderStatsLevelsPane();
  }
}

/** @param {number} x @param {number} y @param {number} z @param {string} txt @param {object} [o] - options (gold/hurt/crit/blue/green/lvl...). Ajoute un texte flottant (voir world/render.js:drawFloats). */
function floatTxt(x,y,z,txt,o={}){ floats.push({x,y,z,txt,life:o.lvl?1.6:1,...o}); }
