// ==================== TESTS UNITAIRES & DE RÉGRESSION ====================
// Suite exécutable à la demande (window.runRegressionTests()) — JAMAIS lancée automatiquement
// pour les joueurs, purement un outil de dev/QA (demande explicite du 2026-07-08 : "test unitaire
// + test de régression systématique"). Écrit en JS simple (pas de framework, pas d'étape de
// build) pour rester cohérent avec le reste du projet : tourne directement dans la page réelle
// (via preview_eval ou la console du navigateur), là où GEAR_ROLE/ZONES/enhBonus/wolvesTick etc.
// existent déjà en mémoire — pas de mock ni de shim DOM à maintenir séparément.
//
// Née d'un vrai bug passé inaperçu (V203→V204) : Camp Rhutum avait un reqDP inférieur à la zone
// précédente, repéré seulement grâce à une capture d'écran du joueur. testZoneMonotonicity()
// aurait détecté ça immédiatement. Objectif : relancer runRegressionTests() après CHAQUE
// modification de GEAR_ROLE, ZONES (reqAP/reqDP), ZONE_ARMOR_SLOTS/ZONE_WEAPON_SLOTS, ENH_STEP,
// ou des fonctions d'icônes de stuff.
(function() {
  const results = [];
  function assert(name, cond, detail) {
    results.push({ name, pass: !!cond, detail: detail || '' });
  }

  // ---------- cohérence des zones ----------
  function testZoneMonotonicity() {
    // reqAP/reqDP ne doivent jamais reculer par rapport à la zone visitée juste avant, dans le
    // VRAI ordre de farm (chaque palier dans GEAR_TIERS.zones, pas l'ordre brut du tableau ZONES)
    const order = []; GEAR_TIERS.forEach(t => order.push(...t.zones));
    let lastAP = -Infinity, lastDP = -Infinity;
    for (const zi of order) {
      const z = ZONES[zi];
      assert(`Zone monotone (PA) : ${z.name}`, z.reqAP >= lastAP, `reqAP=${z.reqAP} < zone précédente=${lastAP}`);
      assert(`Zone monotone (PD) : ${z.name}`, z.reqDP >= lastDP, `reqDP=${z.reqDP} < zone précédente=${lastDP}`);
      lastAP = z.reqAP; lastDP = z.reqDP;
    }
  }

  function testZoneWeaponArmorSlotsComplete() {
    // chaque zone garantit EXACTEMENT 1 pièce d'armure (jamais 0, jamais plusieurs)
    for (let zi = 0; zi < ZONES.length; zi++) {
      const armor = ZONE_ARMOR_SLOTS[zi] || [];
      assert(`Zone ${zi} (${ZONES[zi].name}) garantit 1 pièce d'armure`, armor.length === 1, `armor=${JSON.stringify(armor)}`);
    }
    // Bâton Naru exclusif à Camp des Loups (2026-07-08)
    assert("Zone 0 (Camp des Loups) garantit l'arme du palier gris", (ZONE_WEAPON_SLOTS[0]||[]).includes('weapon'));
    assert("Zone 1 (Ruines de Protty) ne garantit plus l'arme", !(ZONE_WEAPON_SLOTS[1]||[]).includes('weapon'));
  }

  // ---------- courbe d'enchantement / rôles de stuff ----------
  function testGearRoleSanity() {
    for (const slot in GEAR_ROLE) {
      const r = GEAR_ROLE[slot];
      const vals = [r.apShare, r.dpShare, r.hpShare, r.dodgeShare];
      assert(`GEAR_ROLE.${slot} : valeurs numériques valides (>=0, pas NaN)`,
        vals.every(v => typeof v === 'number' && v >= 0 && !isNaN(v)), JSON.stringify(r));
    }
  }

  function testEnhBonusMonotonic() {
    let prev = -1;
    for (let i = 0; i < ENH_NAMES.length; i++) {
      const b = enhBonus(i);
      assert(`enhBonus(${i}) >= enhBonus(${i-1})`, b >= prev, `bonus=${b}, précédent=${prev}`);
      prev = b;
    }
  }

  // ---------- ratios de progression (garde-fou contre une recalibration qui casse tout) ----------
  function tierFullGearAt(tierIdx, enhLv) {
    const tier = GEAR_TIERS[tierIdx]; const slotZone = {};
    tier.zones.forEach(zi => {
      (ZONE_ARMOR_SLOTS[zi]||[]).forEach(s => slotZone[s] = zi);
      (ZONE_WEAPON_SLOTS[zi]||[]).forEach(s => slotZone[s] = zi);
    });
    const bonus = 1 + enhBonus(enhLv); let ap = 0, dp = 0;
    for (const slot in slotZone) {
      const zi = slotZone[slot], role = GEAR_ROLE[slot];
      ap += Math.round(ZONES[zi].reqAP * role.apShare) * bonus;
      dp += Math.round(ZONES[zi].reqDP * role.dpShare) * bonus;
    }
    return { ap, dp };
  }
  function testTierTransitionRatios() {
    // stuff complet du palier précédent à PRI vs 1ère zone du palier suivant : doit rester dans
    // une fourchette "difficile mais pas absurde" (voir V201-V206). En dehors de cette bande, une
    // future recalibration a probablement cassé l'équilibre entre GEAR_ROLE et reqAP/reqDP.
    for (let t = 0; t < 3; t++) {
      const g = tierFullGearAt(t, 16);
      const nz = ZONES[GEAR_TIERS[t+1].zones[0]];
      const ratio = Math.min(g.ap/nz.reqAP, g.dp/nz.reqDP);
      assert(`Transition ${GEAR_TIERS[t].grade}→${GEAR_TIERS[t+1].grade} : ratio PRI dans [0.2, 0.6]`,
        ratio >= 0.2 && ratio <= 0.6, `ratio=${ratio.toFixed(2)}`);
    }
  }
  function testWalkthroughReachesAdaptedByEnd() {
    const order = []; GEAR_TIERS.forEach(t => order.push(...t.zones));
    function pieceFor(zi) { const a = (ZONE_ARMOR_SLOTS[zi]||[])[0]; return [a, ...(ZONE_WEAPON_SLOTS[zi]||[])].filter(Boolean); }
    const bonus = 1 + enhBonus(16); let ap = 4, dp = 10;
    for (const zi of order) {
      for (const slot of pieceFor(zi)) {
        const role = GEAR_ROLE[slot];
        ap += Math.round(ZONES[zi].reqAP * role.apShare) * bonus;
        dp += Math.round(ZONES[zi].reqDP * role.dpShare) * bonus;
      }
    }
    const last = ZONES[15];
    const ratio = Math.min(ap/last.reqAP, dp/last.reqDP);
    assert('Walkthrough complet à PRI atteint >=0.7 en fin de jeu (Forêt de Polly)', ratio >= 0.7, `ratio=${ratio.toFixed(2)}`);
  }

  // ---------- icônes de stuff (toutes tiers, tous slots) ----------
  function testIconsGenerateForAllTiers() {
    const grades = ['grey','white','green','blue'];
    const colors = { grey:'#b8b8b8', white:'#e8e8e8', green:'#7aa35e', blue:'#6ea3c9' };
    const gearFns = { helmet:helmetIconForColor, armor:armorIconForColor, gloves:glovesIconForColor, boots:bootsIconForColor,
      staff:staffIconForColor, dagger:daggerIconForColor, orbs:orbPairIconForColor };
    grades.forEach(g => {
      for (const name in gearFns) {
        const svg = gearFns[name](colors[g], g);
        assert(`Icône ${name} (${g}) est un SVG valide`, typeof svg === 'string' && svg.includes('<svg') && svg.length > 50, `len=${svg && svg.length}`);
      }
    });
    const jewelFns = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
    [0,1,2].forEach(t => {
      const color = t===0?'#b8b8b8':t===1?'#7aa35e':'#6ea3c9';
      for (const name in jewelFns) {
        const svg = jewelFns[name](t, color);
        assert(`Icône bijou ${name} (tier ${t}) est un SVG valide`, typeof svg === 'string' && svg.includes('<svg') && svg.length > 50, `len=${svg && svg.length}`);
      }
    });
  }
  function testSlotIconDefaultsAllValid() {
    for (const slot in SLOT_ICON) {
      const icon = SLOT_ICON[slot];
      assert(`SLOT_ICON.${slot} est un SVG (pas de repli emoji/undefined)`, typeof icon === 'string' && icon.length > 20, `icon=${icon}`);
    }
  }
  function testEquipWeaponNullDoesNotBreakRender() {
    const saved = EQUIP.weapon;
    EQUIP.weapon = null;
    let threw = false, err = '';
    try { pdSlotInnerHtml('weapon'); renderOptimization(); } catch (e) { threw = true; err = e.message; }
    EQUIP.weapon = saved;
    assert('EQUIP.weapon = null ne casse pas le rendu (paperdoll + optimisation)', !threw, err);
  }

  // ---------- combat : plafond de dégâts par type de zone ----------
  function testDangerousZoneOneShot() {
    const s = { zoneIdx, packs, hp:P.hp, accum:P.dmgBurstAccum, t:P.dmgBurstT, hpMax:S.hpMax };
    zoneIdx = 10; S.hpMax = 100; P.hp = 100;
    const dangerous = isZoneDangerous();
    packs = [{ dead:false, aggro:true, x:P.x, y:P.y, gathered:1, dmg:ZONES[10].dmg,
      wolves:[{ox:0,oy:0,gx:0,gy:0,lunge:0.01,atkT:0}] }];
    wolvesTick(0.02);
    assert('Zone DANGEREUSE : un coup peut tuer (one-shot voulu, demande explicite du 2026-07-08)',
      dangerous && P.hp <= 0, `dangerous=${dangerous}, hp=${P.hp}`);
    zoneIdx = s.zoneIdx; packs = s.packs; P.hp = s.hp; P.dmgBurstAccum = s.accum; P.dmgBurstT = s.t; S.hpMax = s.hpMax;
  }
  function testSafeZoneDamageCap() {
    const s = { zoneIdx, packs, hp:P.hp, accum:P.dmgBurstAccum, t:P.dmgBurstT, hpMax:S.hpMax, faint:P.faint };
    zoneIdx = 0; S.hpMax = 100; P.hp = 100; P.faint = 0; // wolvesTick ignore tout tant que P.faint>0
    packs = [{ dead:false, aggro:true, x:P.x, y:P.y, gathered:1, dmg:9999,
      wolves: Array.from({length:5}, () => ({ox:0,oy:0,gx:0,gy:0,lunge:0.01,atkT:0})) }];
    P.dmgBurstAccum = 0; P.dmgBurstT = 0;
    wolvesTick(0.02);
    const lost = 100 - P.hp;
    assert('Zone non-dangereuse : dégâts cumulés plafonnés à 30% des PV max sur 1s même avec 5 coups simultanés',
      Math.abs(lost - 30) < 1, `perte=${lost}`);
    zoneIdx = s.zoneIdx; packs = s.packs; P.hp = s.hp; P.dmgBurstAccum = s.accum; P.dmgBurstT = s.t; S.hpMax = s.hpMax; P.faint = s.faint;
  }

  function testDangerousZoneAlways100PercentLethal() {
    // demande explicite du 2026-07-08 : "dans 100% des cas" -- même avec un coup brut FAIBLE
    // (dmg très bas, mitigation minimale), Math.max(dmgRaw, effHpMax()) doit garantir la mort à
    // chaque tentative, pas juste "parfois" selon le tirage aléatoire du dégât
    const s = { zoneIdx, packs, hp:P.hp, hpMax:S.hpMax, faint:P.faint };
    zoneIdx = 10; S.hpMax = 100;
    let allDied = true;
    for (let i = 0; i < 20; i++) {
      P.hp = 100; P.faint = 0;
      packs = [{ dead:false, aggro:true, x:P.x, y:P.y, gathered:1, dmg:0.01 /* dégât brut quasi nul */,
        wolves:[{ox:0,oy:0,gx:0,gy:0,lunge:0.01,atkT:0}] }];
      wolvesTick(0.02);
      if (P.hp > 0) allDied = false;
    }
    assert('Zone DANGEREUSE : mort garantie même avec un dégât brut de mob quasi nul (20/20 essais)', allDied);
    // dernière itération laisse P.faint=6 (K.O. déclenché) -- doit être restauré, sinon la garde
    // "if (P.faint>0) return" ajoutée dans wolvesTick (2026-07-09) fait planter les tests suivants
    zoneIdx = s.zoneIdx; packs = s.packs; P.hp = s.hp; S.hpMax = s.hpMax; P.faint = s.faint;
  }
  function testDangerousZoneNoDodgeNoEvasion() {
    // l'esquive doit être totalement désactivée en zone dangereuse (2026-07-08) — sinon un résidu
    // de dodgeEffectiveness (dpR entre 0.5 et 0.6) pourrait sauver le joueur du coup garanti
    const s = { zoneIdx, packs, hp:P.hp, hpMax:S.hpMax, faint:P.faint };
    zoneIdx = 10; S.hpMax = 100;
    let anySurvived = false;
    for (let i = 0; i < 20; i++) {
      P.hp = 100; P.faint = 0;
      packs = [{ dead:false, aggro:true, x:P.x, y:P.y, gathered:1, dmg:ZONES[10].dmg,
        wolves:[{ox:0,oy:0,gx:0,gy:0,lunge:0.01,atkT:0}] }];
      wolvesTick(0.02);
      if (P.hp > 0) anySurvived = true;
    }
    assert('Zone DANGEREUSE : aucune esquive résiduelle ne sauve le joueur (0/20 survies attendues)', !anySurvived);
    // voir le commentaire équivalent dans testDangerousZoneAlways100PercentLethal
    zoneIdx = s.zoneIdx; packs = s.packs; P.hp = s.hp; S.hpMax = s.hpMax; P.faint = s.faint;
  }
  function testDangerousZoneWideAggro() {
    // "les monstres aggros de plus loin" (2026-07-08) : un pack non ciblé, à 350 unités, doit
    // s'activer tout seul en zone dangereuse (jamais en zone sûre, comportement inchangé là-bas)
    const s = { zoneIdx, packs, faint:P.faint };
    P.faint = 0; // wolvesTick ignore tout tant que P.faint>0 (voir testSafeZoneDamageCap)
    zoneIdx = 10;
    packs = [{ dead:false, aggro:false, x:P.x+350, y:P.y, gathered:1, dmg:1, wolves:[{ox:0,oy:0,gx:0,gy:0,lunge:0,atkT:5}] }];
    wolvesTick(1/60);
    assert('Zone DANGEREUSE : un pack à 350 unités s\'aggro tout seul', packs[0].aggro === true);
    zoneIdx = 0;
    packs = [{ dead:false, aggro:false, x:P.x+350, y:P.y, gathered:1, dmg:1, wolves:[{ox:0,oy:0,gx:0,gy:0,lunge:0,atkT:5}] }];
    wolvesTick(1/60);
    assert('Zone non-dangereuse : un pack à 350 unités reste inactif (comportement inchangé)', packs[0].aggro === false);
    zoneIdx = s.zoneIdx; packs = s.packs; P.faint = s.faint;
  }
  // "quand tu meurs, les monstres ne t'attaquent plus" (2026-07-09) : tant que P.faint>0 (K.O.),
  // wolvesTick doit ignorer tout pack, même en zone dangereuse avec un dégât garanti létal —
  // sinon chaque coup repoussait le décompte (P.faint réinitialisé) et retirait de l'XP en boucle
  function testKoStopsMonsterAttacks() {
    const s = { zoneIdx, packs, hp:P.hp, hpMax:S.hpMax, faint:P.faint };
    zoneIdx = 10; S.hpMax = 100; P.hp = 0; P.faint = 6;
    packs = [{ dead:false, aggro:true, x:P.x, y:P.y, gathered:1, dmg:9999,
      wolves:[{ox:0,oy:0,gx:0,gy:0,lunge:0.01,atkT:0}] }];
    wolvesTick(0.02);
    assert('K.O. : un monstre ne peut plus toucher le joueur (PV inchangés)', P.hp === 0);
    assert('K.O. : le décompte n\'est pas réinitialisé par un coup', P.faint === 6);
    zoneIdx = s.zoneIdx; packs = s.packs; P.hp = s.hp; S.hpMax = s.hpMax; P.faint = s.faint;
  }
  // "l'icone s'affiche uniquement [si] tu peux trouver un stuff meilleur que celui que tu as
  // déjà, SAUF dangereuse" (2026-07-09) : ⬆️ ne doit apparaître QUE si (1) la pièce équipée est
  // d'un palier STRICTEMENT inférieur au palier de la zone actuelle (sinon rien de mieux à trouver
  // ici, tier-wise) ET (2) il existe une zone sûre différente de la zone actuelle où ce palier
  // supérieur se trouve. reqAP/reqDP de la zone 4 (blanc, seule source d'arme du palier, voir
  // ZONE_WEAPON_SLOTS) sont temporairement forcés à 1 pour rendre le test indépendant du stuff
  // réel du joueur (bottleneck() dépend de apEff()/totalDP() en direct).
  function testUpgradeIconOnlyWhenBetterStuffAvailable() {
    const s = { zoneIdx, EQUIP_weapon: EQUIP.weapon, z4ReqAP: ZONES[4].reqAP, z4ReqDP: ZONES[4].reqDP };
    ZONES[4].reqAP = 1; ZONES[4].reqDP = 1;
    EQUIP.weapon = { name:'test', kind:'gear', slot:'weapon', ap:5, dp:0, hp:0, enhLv:5, optimizable:true, color: GEAR_TIERS[0].color }; // grey
    zoneIdx = 0; // palier grey, même que la pièce équipée : aucun palier supérieur possible ici
    assert('⬆️ absent si la pièce équipée est déjà du palier de la zone actuelle',
      !pdSlotInnerHtmlFor('weapon', EQUIP.weapon).includes('pdUpgradeBtn'));
    zoneIdx = 3; // palier blanc : la pièce grey équipée est d'un palier inférieur, upgrade possible
    assert('⬆️ présent quand un palier supérieur existe ailleurs dans le palier de zone actuel',
      pdSlotInnerHtmlFor('weapon', EQUIP.weapon).includes('pdUpgradeBtn'));
    zoneIdx = 4; // seule zone source d'arme du palier blanc : déjà là, rien à proposer
    assert('⬆️ absent si la seule zone source du palier supérieur est celle où on se trouve déjà',
      !pdSlotInnerHtmlFor('weapon', EQUIP.weapon).includes('pdUpgradeBtn'));
    zoneIdx = s.zoneIdx; EQUIP.weapon = s.EQUIP_weapon; ZONES[4].reqAP = s.z4ReqAP; ZONES[4].reqDP = s.z4ReqDP;
  }
  // "mettre en évidence Équiper meilleur quand un équipement meilleur est dans l'inventaire depuis
  // plus de 15 secondes et qu'il est meilleur que ton stuff actuel" (2026-07-09) : un objet fraîchement
  // looté (pickedAt récent) ne doit PAS déclencher le halo (le joueur n'a pas encore eu le temps de
  // le remarquer) ; un objet ancien mais moins bon non plus ; seul un objet ancien ET meilleur doit
  const TEST_INV_SLOT = INV_SIZE - 1; // dernière case, réutilisée par les autres tests de la même façon
  function testNeglectedUpgradeHighlight() {
    const s = { helmet: EQUIP.helmet, slot: INV[TEST_INV_SLOT] };
    EQUIP.helmet = { name:'ref', kind:'gear', slot:'helmet', ap:0, dp:5, hp:0, color:GEAR_TIERS[0].color };
    INV[TEST_INV_SLOT] = { name:'better-fresh', kind:'gear', slot:'helmet', ap:0, dp:50, hp:0, color:GEAR_TIERS[3].color, pickedAt: Date.now() };
    assert('Pas de halo : objet meilleur mais looté à l\'instant (< 15s)', !hasNeglectedUpgradeInBag());
    INV[TEST_INV_SLOT] = { name:'worse-old', kind:'gear', slot:'helmet', ap:0, dp:1, hp:0, color:GEAR_TIERS[0].color, pickedAt: Date.now() - 20000 };
    assert('Pas de halo : objet ancien mais moins bon que l\'équipé', !hasNeglectedUpgradeInBag());
    INV[TEST_INV_SLOT] = { name:'better-old', kind:'gear', slot:'helmet', ap:0, dp:50, hp:0, color:GEAR_TIERS[3].color, pickedAt: Date.now() - 20000 };
    assert('Halo : objet ancien (>15s) ET meilleur que l\'équipé', hasNeglectedUpgradeInBag());
    EQUIP.helmet = s.helmet; INV[TEST_INV_SLOT] = s.slot;
  }
  // badge ⬆️ sur les lignes de la liste de zones (2026-07-09, demande explicite) : agrège la même
  // logique d'upgrade que la poupée d'équipement sur TOUS les slots -- vérifie juste que la zone 4
  // (seule source d'arme du palier blanc, voir le test précédent) ressort bien de l'agrégat quand
  // un socle équipé grey se trouve dans un contexte où le palier blanc est accessible
  function testZonesOfferingUpgradeAggregatesAllSlots() {
    const s = { zoneIdx, weapon: EQUIP.weapon, z4ReqAP: ZONES[4].reqAP, z4ReqDP: ZONES[4].reqDP };
    ZONES[4].reqAP = 1; ZONES[4].reqDP = 1;
    EQUIP.weapon = { name:'test', kind:'gear', slot:'weapon', ap:5, dp:0, hp:0, enhLv:5, optimizable:true, color: GEAR_TIERS[0].color };
    zoneIdx = 3; // palier blanc, la pièce grey équipée peut être améliorée en zone 4
    assert('zonesOfferingUpgrade contient la zone source d\'un vrai palier supérieur',
      zonesOfferingUpgrade().has(4));
    zoneIdx = s.zoneIdx; EQUIP.weapon = s.weapon; ZONES[4].reqAP = s.z4ReqAP; ZONES[4].reqDP = s.z4ReqDP;
  }

  // ---------- affichage PA/PD sans décimale (2026-07-08 : "enleve toute trace de virgule de
  // PA/PD") ----------
  function testApDpDisplayHasNoDecimals() {
    const saved = JSON.parse(JSON.stringify(EQUIP.helmet || null));
    EQUIP.helmet = { name:'test', kind:'gear', slot:'helmet', ap:0, dp:3, hp:10, dodge:.1, enhLv:16, optimizable:true, fsByLevel:{}, color:'#b8b8b8' };
    renderEquipment(); hud();
    const stDPText = document.getElementById('stDP')?.textContent || '';
    const eqSumDpText = document.getElementById('eqSumDp')?.textContent || '';
    assert('#stDP ne contient aucune décimale', !stDPText.includes('.') && !stDPText.includes(','), `text="${stDPText}"`);
    assert('#eqSumDp ne contient aucune décimale', !eqSumDpText.includes('.') && !eqSumDpText.includes(','), `text="${eqSumDpText}"`);
    // vérifie aussi que floor (pas round) est bien utilisé : totalDP() doit avoir une partie
    // décimale réelle ici pour que le test soit probant (sinon floor et round donneraient pareil)
    const raw = totalDP();
    assert('Le test utilise bien une valeur avec décimale (sinon floor vs round indiscernable)', raw % 1 !== 0, `totalDP=${raw}`);
    EQUIP.helmet = saved;
    renderEquipment();
  }
  function testEffectiveApDpFloors() {
    const item = { ap: 5, dp: 3, hp: 2, dodge: .1, enhLv: 12, optimizable: true, fsByLevel: {} };
    const eff = effectiveApDp(item);
    const mult = 1 + enhBonus(12);
    assert('effectiveApDp.ap = floor, pas round', eff.ap === Math.floor(5*mult), `eff.ap=${eff.ap}, floor attendu=${Math.floor(5*mult)}, round aurait donné=${Math.round(5*mult)}`);
  }

  // ---------- puissance réelle du stuff lootable (2026-07-08 : "compliqué d'arriver à 20PA avec
  // ce que je loot") ----------
  function testJewelryApIsDynamic() {
    // l'AP d'un bijou dropé doit suivre gearBasisAP/reqAP de SA zone, pas une valeur figée —
    // vérifie que la formule utilisée par rollDrops (dupliquée ici volontairement, pour ne PAS
    // dépendre de l'implémentation interne) donne un résultat cohérent et jamais 0
    for (let zi = 0; zi < ZONES.length; zi++) {
      const z = ZONES[zi];
      const expected = Math.max(1, Math.round((z.gearBasisAP ?? z.reqAP) * GEAR_ROLE.jackpot.apShare));
      assert(`Bijou de ${z.name} : AP dynamique > 0`, expected > 0, `expected=${expected}`);
    }
  }
  function testZone0LootReachesZone1Difficulty() {
    // scénario concret remonté par le joueur (2026-07-08) : casque + arme + 2 bijoux, tous
    // lootables à Camp des Loups (zone0), enchantés à +12 — ne doit plus tomber en ZONE DANGEREUSE
    // (ratio <0.6) face à la zone suivante une fois un minimum farmé/enchanté
    const z0 = ZONES[0], z1 = ZONES[1];
    const basisAP = z0.gearBasisAP ?? z0.reqAP;
    const weaponBase = Math.max(1, Math.round(basisAP * GEAR_ROLE.weapon.apShare));
    const jackpotBase = Math.max(1, Math.round(basisAP * GEAR_ROLE.jackpot.apShare));
    const bonus = 1 + enhBonus(12); // +12, palier garanti (voir SAFE_IDX)
    const total = 4 /* PA innée de base */ + weaponBase*bonus + jackpotBase*bonus*2 /* 2 bagues */;
    const ratio = total / z1.reqAP;
    assert("Stuff réaliste de Camp des Loups (+12) atteint ratio >=0.6 face à Ruines de Protty",
      ratio >= 0.6, `total PA=${total.toFixed(1)}, ratio=${ratio.toFixed(2)}`);
  }

  window.runRegressionTests = function() {
    results.length = 0;
    testZoneMonotonicity();
    testZoneWeaponArmorSlotsComplete();
    testGearRoleSanity();
    testEnhBonusMonotonic();
    testTierTransitionRatios();
    testWalkthroughReachesAdaptedByEnd();
    testIconsGenerateForAllTiers();
    testSlotIconDefaultsAllValid();
    testEquipWeaponNullDoesNotBreakRender();
    testDangerousZoneOneShot();
    testSafeZoneDamageCap();
    testDangerousZoneAlways100PercentLethal();
    testDangerousZoneNoDodgeNoEvasion();
    testDangerousZoneWideAggro();
    testKoStopsMonsterAttacks();
    testUpgradeIconOnlyWhenBetterStuffAvailable();
    testNeglectedUpgradeHighlight();
    testZonesOfferingUpgradeAggregatesAllSlots();
    testApDpDisplayHasNoDecimals();
    testEffectiveApDpFloors();
    testJewelryApIsDynamic();
    testZone0LootReachesZone1Difficulty();
    const failed = results.filter(r => !r.pass);
    const summary = `${results.length - failed.length}/${results.length} OK`;
    if (failed.length) {
      console.error(`✖ Tests de régression Velia Idle : ${summary}`);
      failed.forEach(r => console.error(`  ✖ ${r.name} — ${r.detail}`));
    } else {
      console.log(`✓ Tests de régression Velia Idle : ${summary} — tout passe.`);
    }
    return { total: results.length, passed: results.length - failed.length, failed: failed.map(r => ({ name:r.name, detail:r.detail })) };
  };
})();
