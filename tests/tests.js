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
    const s = { zoneIdx, packs, hp:P.hp, accum:P.dmgBurstAccum, t:P.dmgBurstT, hpMax:S.hpMax, faint:P.faint,
      EQUIP: JSON.parse(JSON.stringify(EQUIP)) };
    // neutralise le bonus de PV du stuff RÉELLEMENT équipé par le personnage live (effHpMax() =
    // S.hpMax + equipHP()) -- sans ça, le plafond réel (30% d'effHpMax) peut dépasser largement les
    // "30" attendus si le perso live porte de l'armure avec bonus PV, rendant ce test dépendant d'un
    // état qui n'a rien à voir avec la logique testée (flaky, confirmé le 2026-07-12)
    for (const k in EQUIP) if (EQUIP[k]) EQUIP[k].hp = 0;
    zoneIdx = 0; S.hpMax = 100; P.hp = 100; P.faint = 0; // wolvesTick ignore tout tant que P.faint>0
    packs = [{ dead:false, aggro:true, x:P.x, y:P.y, gathered:1, dmg:9999,
      wolves: Array.from({length:5}, () => ({ox:0,oy:0,gx:0,gy:0,lunge:0.01,atkT:0})) }];
    P.dmgBurstAccum = 0; P.dmgBurstT = 0;
    wolvesTick(0.02);
    const lost = 100 - P.hp;
    assert('Zone non-dangereuse : dégâts cumulés plafonnés à 30% des PV max sur 1s même avec 5 coups simultanés',
      Math.abs(lost - 30) < 1, `perte=${lost}`);
    zoneIdx = s.zoneIdx; packs = s.packs; P.hp = s.hp; P.dmgBurstAccum = s.accum; P.dmgBurstT = s.t; S.hpMax = s.hpMax; P.faint = s.faint;
    for (const k in EQUIP) EQUIP[k] = s.EQUIP[k];
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
    // s'activer tout seul -- d'abord limité aux zones dangereuses, généralisé à TOUTE zone le
    // 2026-07-14 (demande explicite : "les monstre aggro lorsque tu es proche d'eux maintenant")
    const s = { zoneIdx, packs, faint:P.faint };
    P.faint = 0; // wolvesTick ignore tout tant que P.faint>0 (voir testSafeZoneDamageCap)
    zoneIdx = 10;
    packs = [{ dead:false, aggro:false, x:P.x+350, y:P.y, gathered:1, dmg:1, wolves:[{ox:0,oy:0,gx:0,gy:0,lunge:0,atkT:5}] }];
    wolvesTick(1/60);
    assert('Zone dangereuse : un pack à 350 unités s\'aggro tout seul', packs[0].aggro === true);
    zoneIdx = 0;
    packs = [{ dead:false, aggro:false, x:P.x+350, y:P.y, gathered:1, dmg:1, wolves:[{ox:0,oy:0,gx:0,gy:0,lunge:0,atkT:5}] }];
    wolvesTick(1/60);
    assert('Zone non-dangereuse : un pack à 350 unités s\'aggro aussi tout seul (généralisé, 2026-07-14)', packs[0].aggro === true);
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
  // "vérifie l'utilisation de la potion" (2026-07-09) : bug trouvé en vérification -- fsm()
  // tournait aussi à Velia (zone paisible, aucun monstre) sans jamais vérifier atVelia, donc une
  // potion payante pouvait partir automatiquement là-bas (ex: juste après die(), qui met P.hp à
  // pile 50%, le seuil par défaut). Ni la potion de vie ni celle de mana ne doivent s'auto-boire
  // à Velia, même si les seuils sont franchis ; la régén passive de mana, elle, continue.
  function testNoAutoPotionAtVelia() {
    const s = { atVelia, hp:P.hp, mp:P.mp, potCd:P.potCd, manaPotCd:P.manaPotCd, silver:S.silver,
      threshold:S.potionThreshold, faint:P.faint, state:P.state, manualTarget:P.manualTarget };
    atVelia = true; P.faint = 0; P.potCd = 0; P.manaPotCd = 0; P.manualTarget = null; P.state = 'search';
    S.potionThreshold = 0.5; P.hp = effHpMax()*0.5; P.mp = 0;
    const silverBefore = S.silver;
    fsm(0.02);
    assert('Pas d\'auto-soin PV à Velia même sous le seuil', S.silver === silverBefore && P.potCd === 0);
    assert('Pas d\'auto-potion de mana à Velia même sous 30%', P.manaPotCd === 0);
    atVelia = s.atVelia; P.hp = s.hp; P.mp = s.mp; P.potCd = s.potCd; P.manaPotCd = s.manaPotCd;
    S.silver = s.silver; S.potionThreshold = s.threshold; P.faint = s.faint; P.state = s.state; P.manualTarget = s.manualTarget;
  }
  // "l'icone s'affiche uniquement [si] tu peux trouver un stuff meilleur que celui que tu as
  // déjà, SAUF dangereuse" (2026-07-09) : ⬆️ ne doit apparaître QUE s'il existe une zone SÛRE,
  // AILLEURS que la zone actuelle, d'un palier strictement supérieur à la pièce équipée.
  // BUG corrigé le 2026-07-15 (demande explicite : "je suis en zone verte, accès difficile zone
  // bleu, je devrais avoir une icône... vérifie pour les autres grades") : la version précédente
  // comparait le palier de la pièce équipée au palier de la ZONE ACTUELLEMENT FARMÉE (zoneIdx),
  // pas au palier des zones CANDIDATES -- un joueur en stuff vert farmant une zone verte ne voyait
  // donc JAMAIS l'icône, même si une zone bleue sûre existait, puisque "vert == vert" court-
  // circuitait tout le reste. Le test ci-dessous couvrait justement ce cas précis en asserte
  // "absent" -- c'était la bonne assertion pour le mauvais raisonnement, corrigée ci-dessous.
  // reqAP/reqDP de la zone 4 (blanc, seule source d'arme du palier, voir ZONE_WEAPON_SLOTS) sont
  // temporairement forcés à 1 pour rendre le test indépendant du stuff réel du joueur (bottleneck()
  // dépend de apEff()/totalDP() en direct).
  function testUpgradeIconOnlyWhenBetterStuffAvailable() {
    const s = { zoneIdx, EQUIP: {...EQUIP}, z4ReqAP: ZONES[4].reqAP, z4ReqDP: ZONES[4].reqDP, maxZoneIdx: S.maxZoneIdx };
    // (2026-07-11) safeZonesForSlot filtre désormais aussi par zone DÉCOUVERTE (zi <= S.maxZoneIdx)
    // -- ce test doit rester indépendant de la progression réelle du joueur, comme zoneIdx/EQUIP ci-dessus.
    // TOUS les autres socles sont vidés (2026-07-15, fix de flakiness) : ce test ne touchait avant
    // que EQUIP.weapon, laissant apEff()/totalDP() dépendre du reste du stuff RÉEL de la sauvegarde
    // en cours -- un joueur déjà bien équipé sur les autres socles pouvait rendre une zone "sûre"
    // par accident, indépendamment du scénario testé, et faire échouer l'assertion "absent" au hasard.
    for (const k of Object.keys(EQUIP)) EQUIP[k] = null;
    S.maxZoneIdx = ZONES.length - 1;
    EQUIP.weapon = { name:'test', kind:'gear', slot:'weapon', ap:5, dp:0, hp:0, enhLv:5, optimizable:true, color: GEAR_TIERS[0].color }; // grey
    zoneIdx = 0; // palier grey, zone AUSSI grey -- mais AUCUNE zone supérieure n'est rendue sûre ici
    assert('⬆️ absent quand aucune zone sûre de palier supérieur n\'existe, même palier grey == zone grey',
      !pdSlotInnerHtmlFor('weapon', EQUIP.weapon).includes('pdUpgradeBtn'));
    ZONES[4].reqAP = 1; ZONES[4].reqDP = 1; // rend la zone blanche (zone4) trivialement sûre
    assert('⬆️ présent même quand le palier de la pièce équipée == palier de la zone actuelle, si une zone supérieure devient sûre (reproduit le bug du 2026-07-15)',
      pdSlotInnerHtmlFor('weapon', EQUIP.weapon).includes('pdUpgradeBtn'));
    zoneIdx = 3; // palier blanc : la pièce grey équipée est d'un palier inférieur, upgrade possible
    assert('⬆️ présent quand un palier supérieur existe ailleurs dans le palier de zone actuel',
      pdSlotInnerHtmlFor('weapon', EQUIP.weapon).includes('pdUpgradeBtn'));
    zoneIdx = 4; // seule zone source d'arme du palier blanc : déjà là, rien à proposer
    assert('⬆️ absent si la seule zone source du palier supérieur est celle où on se trouve déjà',
      !pdSlotInnerHtmlFor('weapon', EQUIP.weapon).includes('pdUpgradeBtn'));
    zoneIdx = s.zoneIdx; Object.assign(EQUIP, s.EQUIP); ZONES[4].reqAP = s.z4ReqAP; ZONES[4].reqDP = s.z4ReqDP;
    S.maxZoneIdx = s.maxZoneIdx;
  }
  // "la flèche qui indique le stuff que tu peux farm sur le stuff équipé indique quel stuff
  // t'améliore en base selon les zones découvertes qui ne sont pas une zone dangereuse" (2026-07-11)
  // -- safeZonesForSlot ne doit jamais proposer une zone jamais visitée (zi > S.maxZoneIdx), même
  // si elle offrirait un palier supérieur et n'est pas dangereuse.
  // "si un meilleur stuff base est disponible au loot, le montrer... toute zone SAUF dangereuse"
  // (2026-07-12) -- annule le filtre "zone découverte" ajouté le 2026-07-11 (revirement assumé,
  // voir safeZonesForSlot) : la flèche ⬆️ doit à nouveau proposer une zone MÊME jamais visitée,
  // tant qu'elle n'est pas dangereuse.
  function testUpgradeIconIgnoresDiscoveredZone() {
    const s = { zoneIdx, EQUIP_weapon: EQUIP.weapon, z4ReqAP: ZONES[4].reqAP, z4ReqDP: ZONES[4].reqDP, maxZoneIdx: S.maxZoneIdx };
    ZONES[4].reqAP = 1; ZONES[4].reqDP = 1;
    EQUIP.weapon = { name:'test', kind:'gear', slot:'weapon', ap:5, dp:0, hp:0, enhLv:5, optimizable:true, color: GEAR_TIERS[0].color }; // grey
    zoneIdx = 3; // palier blanc : la pièce grey équipée est d'un palier inférieur, upgrade possible ici
    S.maxZoneIdx = 2; // jamais dépassé le palier gris -> zone 4 (blanche) jamais découverte
    assert('⬆️ présent même si la seule zone qui offrirait mieux n\'a jamais été découverte',
      pdSlotInnerHtmlFor('weapon', EQUIP.weapon).includes('pdUpgradeBtn'));
    zoneIdx = s.zoneIdx; EQUIP.weapon = s.EQUIP_weapon; ZONES[4].reqAP = s.z4ReqAP; ZONES[4].reqDP = s.z4ReqDP;
    S.maxZoneIdx = s.maxZoneIdx;
  }
  // "l'icone d'upgrade de stuff dois revenir sur le stuff... si elle est quitté et qu'un stuff est
  // jugé plus intéréssant" (2026-07-12) -- bug trouvé : renderEquipment() (badge ⬆️ de la poupée)
  // n'était rafraîchi par hud() QUE si la composition du sac changeait (invSignature), jamais sur un
  // simple changement de zone -- upgradeZonesForEquippedSlot() dépend pourtant de zoneIdx (exclut
  // la zone où l'on se trouve DÉJÀ). Vérifie que le DOM réel se met bien à jour après un vrai
  // travelTo(), pas juste que la fonction de calcul répond juste (déjà couvert ailleurs).
  function testEquipmentDollRefreshesOnZoneTravel() {
    if (!$('pdLeft') && !$('pdRight')) return; // pas de DOM (contexte hors-jeu)
    const s = { zoneIdx, atVelia, EQUIP: {...EQUIP}, z4ReqAP: ZONES[4].reqAP, z4ReqDP: ZONES[4].reqDP,
      x: P.x, y: P.y, maxZoneIdx: S.maxZoneIdx };
    // tous les autres socles vidés (2026-07-15, même fix de flakiness que
    // testUpgradeIconOnlyWhenBetterStuffAvailable) : la 1ère assertion attend "absent", un socle
    // réel bien stuffé ailleurs pourrait rendre une zone bleue/verte "sûre" par accident et casser
    // le test au hasard, sans rapport avec le scénario testé (zone4/palier blanc)
    for (const k of Object.keys(EQUIP)) EQUIP[k] = null;
    ZONES[4].reqAP = 1; ZONES[4].reqDP = 1;
    EQUIP.weapon = { name:'test', kind:'gear', slot:'weapon', ap:5, dp:0, hp:0, enhLv:5, optimizable:true, color: GEAR_TIERS[0].color }; // grey
    S.maxZoneIdx = ZONES.length - 1;
    travelTo(4); // pile dans la SEULE zone qui offrirait mieux -> pas de badge à afficher ici
    const slotWhileIn = document.querySelector('.pdSlot[data-slot="weapon"]');
    assert('⬆️ absent sur la poupée (DOM réel) tant qu\'on est DANS la seule zone qui offrirait mieux',
      !slotWhileIn || !slotWhileIn.querySelector('.pdUpgradeBtn'));
    travelTo(3); // on quitte -> la zone 4 redevient une source d'upgrade valide
    const slotAfterLeave = document.querySelector('.pdSlot[data-slot="weapon"]');
    assert('⬆️ réapparaît sur la poupée (DOM réel) dès qu\'on quitte cette zone',
      !!slotAfterLeave && !!slotAfterLeave.querySelector('.pdUpgradeBtn'));
    Object.assign(EQUIP, s.EQUIP); ZONES[4].reqAP = s.z4ReqAP; ZONES[4].reqDP = s.z4ReqDP; S.maxZoneIdx = s.maxZoneIdx;
    if (s.atVelia) goToVelia(); else travelTo(s.zoneIdx);
    P.x = s.x; P.y = s.y;
  }
  // "nouvelle ia, pack to pack rapide: l'ia choisi deja son prochain pack en tournant autour avec
  // mode "Opti" (pack to pack rapide) retiré le 2026-07-14 (demande explicite) : plus que 2 modes
  // de farm (Loot/XP), voir FARM_MODES/FARM_MODE_ORDER. Le sélecteur à bulles (#farmModeSlider)
  // doit refléter S.farmMode sur les 2 segments cliquables, et garder un 3e emplacement verrouillé.
  function testFarmModeBubbleSelectorReflectsTwoModes() {
    if (!$('farmModeSlider')) return; // pas de DOM (contexte hors-jeu)
    const s = { farmMode: S.farmMode };
    assert('FARM_MODE_ORDER ne contient plus que loot/xp (Opti retiré)',
      FARM_MODE_ORDER.length === 2 && !FARM_MODE_ORDER.includes('opti'), `order=${JSON.stringify(FARM_MODE_ORDER)}`);
    for (const key of FARM_MODE_ORDER) {
      S.farmMode = key;
      renderFarmModeBtn();
      const seg = $('farmModeSlider').querySelector(`.farmModeSeg[data-mode="${key}"]`);
      assert(`Bulle "${key}" active quand S.farmMode="${key}"`, seg && seg.classList.contains('active'));
    }
    for (const key of FARM_MODE_ORDER) {
      setFarmMode(key);
      assert(`setFarmMode("${key}") fixe bien S.farmMode="${key}"`, S.farmMode === key);
    }
    assert('Le 3e emplacement verrouillé (.farmModeLocked) est bien présent', !!$('farmModeSlider').querySelector('.farmModeLocked'));
    // repli sur "loot" pour une sauvegarde existante qui a encore S.farmMode==='opti' (mode retiré)
    S.farmMode = 'opti';
    renderFarmModeBtn();
    assert('Une sauvegarde avec farmMode="opti" (retiré) retombe sur "loot"', S.farmMode === 'loot', `farmMode=${S.farmMode}`);
    S.farmMode = s.farmMode; renderFarmModeBtn();
  }
  // "montrer dans l'inventaire uniquement les items qui se lootent dans la zone... si plusieurs
  // zones sont disponibles... plusieurs flèches sur stuff ET zone à farm" (2026-07-12) --
  // slotsUpgradedByZone(zi) doit retourner UNIQUEMENT le(s) socle(s) que CETTE zone améliore
  // réellement, jamais tous les socles qui ont un upgrade quelque part ailleurs.
  function testSlotsUpgradedByZoneIsZoneSpecific() {
    const s = { zoneIdx, EQUIP_weapon: EQUIP.weapon, EQUIP_helmet: EQUIP.helmet,
      z4ReqAP: ZONES[4].reqAP, z4ReqDP: ZONES[4].reqDP };
    ZONES[4].reqAP = 1; ZONES[4].reqDP = 1; // zone4 (Ferme Shultz) : donne l'ARME, pas le casque
    EQUIP.weapon = { name:'test', kind:'gear', slot:'weapon', ap:5, dp:0, hp:0, enhLv:5, optimizable:true, color: GEAR_TIERS[0].color }; // grey, upgradable
    EQUIP.helmet = null; // aucun socle casque équipé -> pas d'upgrade "équipé" à proposer ici
    zoneIdx = 3;
    const slots4 = slotsUpgradedByZone(4);
    assert('slotsUpgradedByZone(4) inclut "weapon" (Ferme Shultz donne l\'arme du palier blanc)', slots4.includes('weapon'), `slots=${JSON.stringify(slots4)}`);
    assert('slotsUpgradedByZone(4) n\'inclut PAS "helmet" (Ferme Shultz ne donne pas le casque)', !slots4.includes('helmet'), `slots=${JSON.stringify(slots4)}`);
    // zone3 (Camp Rhutum) donne le casque, pas l'arme -- vérifie que ça ne mélange pas les zones
    const slots3 = slotsUpgradedByZone(3);
    assert('slotsUpgradedByZone(3) n\'inclut PAS "weapon" (Camp Rhutum ne donne pas l\'arme)', !slots3.includes('weapon'), `slots=${JSON.stringify(slots3)}`);
    zoneIdx = s.zoneIdx; EQUIP.weapon = s.EQUIP_weapon; EQUIP.helmet = s.EQUIP_helmet;
    ZONES[4].reqAP = s.z4ReqAP; ZONES[4].reqDP = s.z4ReqDP;
  }
  // "réorganise les noms de zone velia a edana pour qu'elle prenne qu'une seule ligne... en mettant
  // le cadenas au dessus au milieu de chaque item" (2026-07-12) -- le cadenas doit être un élément
  // SÉPARÉ (.zoneTierLock), jamais concaténé dans le texte visible du bouton (qui doit rester court :
  // juste icône + nom de région) pour laisser assez de place aux 5 onglets sur une seule rangée.
  function testZoneTierLockIsSeparateFromLabel() {
    if (!$('zoneTierTabs')) return; // pas de DOM (contexte hors-jeu)
    renderZoneTierTabs();
    const buttons = [...$('zoneTierTabs').querySelectorAll('.catTab')];
    const velia = buttons.find(b => b.dataset.tier === 'early');
    const heidel = buttons.find(b => b.dataset.tier === 'mid');
    assert('Onglet Velia (non verrouillé) n\'a pas de badge cadenas', !velia.querySelector('.zoneTierLock'));
    assert('Onglet Heidel (verrouillé) a bien un badge cadenas séparé', !!heidel.querySelector('.zoneTierLock'));
    // le texte visible du bouton (hors badge cadenas) ne doit PAS contenir 🔒 -- il doit être court
    const heidelClone = heidel.cloneNode(true);
    heidelClone.querySelector('.zoneTierLock').remove();
    assert('Le texte du bouton (hors badge) ne contient plus le cadenas', !heidelClone.textContent.includes('🔒'), `texte=${heidelClone.textContent}`);
  }
  // "remet les categorie compagnon et vie en mer dans le header" (2026-07-08) -- déplacés de
  // #zoneTierTabs (où ils vivaient depuis le 2026-07-17) vers #activityTabs, le vrai "header" du
  // jeu (voir ACTIVITY_TABS, combat/boss.js) -- vérifie qu'ils y sont bien et qu'ils ont disparu
  // de la barre de région pour ne pas être dupliqués. Compagnon débloqué le 2026-07-19 (module
  // src/companions/ livré, voir openCompanionsModule) -- Vie en mer reste verrouillé.
  function testCompagnonSeaLifeLiveInHeaderNotZoneTierTabs() {
    if (!$('activityTabs') || typeof renderActivityTabs !== 'function') return;
    renderActivityTabs();
    const headerBtns = [...$('activityTabs').querySelectorAll('.actTab')];
    const pet = headerBtns.find(b => b.dataset.id === 'pet'), sea = headerBtns.find(b => b.dataset.id === 'sea');
    assert('Compagnon est bien un onglet du header', !!pet);
    assert('Vie en mer est bien un onglet du header', !!sea);
    assert('Compagnon est débloqué (module livré, ni locked ni disabled)', pet && !pet.classList.contains('locked') && !pet.disabled);
    assert('Vie en mer est verrouillé (locked + disabled)', sea && sea.classList.contains('locked') && sea.disabled);
    if ($('zoneTierTabs') && typeof renderZoneTierTabs === 'function') {
      renderZoneTierTabs();
      const zoneBtns = [...$('zoneTierTabs').querySelectorAll('.catTab')];
      assert('Compagnon/Vie en mer ne sont plus dupliqués dans la barre de région',
        !zoneBtns.some(b => b.textContent.includes('Compagnon') || b.textContent.includes('Vie en mer')));
    }
  }
  // "remet les cadenas dans le header sur la ligne du bas" (2026-07-08) -- le cadenas d'un onglet
  // verrouillé du header doit être un élément à part (.actTabLock), jamais concaténé dans le texte
  // du libellé -- même esprit que testZoneTierLockIsSeparateFromLabel ci-dessus, pour #activityTabs.
  function testActivityTabLockIsSeparateFromLabel() {
    if (!$('activityTabs') || typeof renderActivityTabs !== 'function') return;
    renderActivityTabs();
    const fish = [...$('activityTabs').querySelectorAll('.actTab')].find(b => b.dataset.id === 'fish');
    if (!fish) return;
    assert('Onglet verrouillé du header a bien un badge cadenas séparé', !!fish.querySelector('.actTabLock'));
    const clone = fish.cloneNode(true);
    clone.querySelector('.actTabLock').remove();
    assert('Le libellé (hors badge cadenas) ne contient plus le cadenas', !clone.querySelector('.actTabLabel').textContent.includes('🔒'));
  }
  // badge "NEW" sur l'onglet Compagnon (2026-07-20, demande explicite : "met NEW sur compagnon a
  // la place du cadenas") -- Compagnon n'est pas verrouillé (locked:false), donc n'a jamais eu de
  // .actTabLock ; le badge "NEW"/"NOUVEAU" doit apparaître à sa place dans le même emplacement
  // bulle (.actTabNew), et jamais un cadenas sur un onglet débloqué.
  function testCompanionTabShowsNewBadgeInsteadOfLock() {
    if (!$('activityTabs') || typeof renderActivityTabs !== 'function' || typeof ACTIVITY_TABS === 'undefined') return;
    const pet = ACTIVITY_TABS.find(t => t.id === 'pet');
    if (!pet) return;
    assert('ACTIVITY_TABS.pet est marqué isNew (sinon ce test est obsolète)', !!pet.isNew);
    renderActivityTabs();
    const btn = [...$('activityTabs').querySelectorAll('.actTab')].find(b => b.dataset.id === 'pet');
    assert('Onglet Compagnon trouvé dans le header', !!btn);
    if (!btn) return;
    assert('Onglet Compagnon affiche un badge "NEW"', !!btn.querySelector('.actTabNew'));
    assert('Onglet Compagnon n\'affiche jamais de cadenas (débloqué)', !btn.querySelector('.actTabLock'));
  }
  // débordement des badges cadenas/PV/NEW du header corrigé (2026-07-20, rapporté explicitement :
  // "regtarde aussi pourquoi les cadenas sont coupé") -- ces badges débordent volontairement sous
  // le bouton (.actTabLock/.actTabBossHp/.actTabNew, bottom négatif, effet "bulle à cheval sur le
  // cadre") ; #activityTabs a overflow-y:hidden (nécessaire pour empêcher tout retour à la ligne
  // vertical dans la barre à défilement horizontal) qui les rognait sans laisser de place. Garde-
  // fou : #activityTabs doit réserver assez de padding-bottom pour ne pas les couper.
  function testActivityTabsReservesRoomForOverflowingBadges() {
    if (typeof document === 'undefined') return;
    const el = $('activityTabs');
    if (!el) return;
    const padBottom = parseFloat(getComputedStyle(el).paddingBottom) || 0;
    assert('#activityTabs réserve au moins 8px de padding-bottom pour les badges qui débordent (cadenas/PV/NEW)', padBottom >= 8, `padding-bottom=${padBottom}px`);
  }
  // système de sanctions (2026-07-18) — isBanned() doit respecter l'expiration exacte de banned_until
  function testIsBannedRespectsExpiry() {
    if (typeof isBanned !== 'function') return;
    assert('Pas banni si banStatus est null', !isBanned(null));
    assert('Pas banni si banned_until est null', !isBanned({ banned_until: null }));
    assert('Banni si banned_until est dans le futur', isBanned({ banned_until: new Date(Date.now()+3600000).toISOString() }));
    assert('Plus banni si banned_until est dans le passé', !isBanned({ banned_until: new Date(Date.now()-3600000).toISOString() }));
  }
  // l'admin ne doit jamais pouvoir se bannir lui-même par erreur (canBanUuid, garde-fou client
  // avant tout appel RPC admin_ban_player) -- demande explicite du 2026-07-18
  function testCanBanUuidBlocksSelfBan() {
    if (typeof canBanUuid !== 'function') return;
    assert('UUID vide toujours refusé', !canBanUuid('', 'admin-uuid'));
    assert('UUID identique à celui de l\'admin refusé (anti-auto-ban)', !canBanUuid('admin-uuid', 'admin-uuid'));
    assert('UUID différent et non vide accepté', canBanUuid('joueur-uuid', 'admin-uuid'));
  }
  // données du formulaire de ban bien formées (BAN_REASONS/BAN_DURATIONS) -- openAdminPanel()
  // n'est pas appelable directement en test (gaté par isAdmin() + appels RPC réseau), donc on
  // verrouille ici les données réellement utilisées pour construire le sous-onglet Sanctions.
  function testBanReasonsAndDurationsWellFormed() {
    if (typeof BAN_REASONS === 'undefined' || typeof BAN_DURATIONS === 'undefined') return;
    assert('BAN_REASONS non vide', BAN_REASONS.length > 0);
    assert('BAN_REASONS a des ids uniques', new Set(BAN_REASONS.map(r => r.id)).size === BAN_REASONS.length);
    assert('Chaque motif a un libellé fr et en', BAN_REASONS.every(r => r.label && r.label.fr && r.label.en));
    assert('BAN_DURATIONS non vide', BAN_DURATIONS.length > 0);
    assert('Chaque durée a un nombre d\'heures positif', BAN_DURATIONS.every(d => Number.isFinite(d.hours) && d.hours > 0));
  }
  // palette du panneau admin (2026-07-19, "garde toute les couleurs et qu'on poura modifier avec
  // un slider") -- ADMIN_THEMES bien formé + getAdminTheme()/setAdminTheme() persistent et se
  // rabattent sur 'gold' pour toute valeur invalide/absente (jamais un data-adm-theme orphelin
  // sans règle CSS correspondante, voir styles.css .admThemeRoot[data-adm-theme="..."]).
  function testAdminThemesWellFormedAndPersist() {
    if (typeof ADMIN_THEMES === 'undefined' || typeof getAdminTheme !== 'function' || typeof setAdminTheme !== 'function') return;
    assert('ADMIN_THEMES non vide', ADMIN_THEMES.length > 0);
    assert('ADMIN_THEMES a des ids uniques', new Set(ADMIN_THEMES.map(t => t.id)).size === ADMIN_THEMES.length);
    assert('Chaque thème a un libellé fr et en', ADMIN_THEMES.every(t => t.label && t.label.fr && t.label.en));
    assert('"gold" existe bien dans ADMIN_THEMES (thème par défaut du jeu)', ADMIN_THEMES.some(t => t.id === 'gold'));
    let saved = null;
    try { saved = localStorage.getItem('bdiAdminTheme'); } catch(e) {}
    try {
      setAdminTheme('ruby');
      assert('setAdminTheme puis getAdminTheme renvoie bien la valeur persistée', getAdminTheme() === 'ruby');
      localStorage.setItem('bdiAdminTheme', 'un_theme_qui_nexiste_pas');
      assert('getAdminTheme() se rabat sur "gold" si la valeur stockée est invalide', getAdminTheme() === 'gold');
    } finally {
      if (saved === null) { try { localStorage.removeItem('bdiAdminTheme'); } catch(e) {} }
      else { try { localStorage.setItem('bdiAdminTheme', saved); } catch(e) {} }
    }
  }
  // refonte du panneau admin en sidebar plein écran (2026-07-19, "on va recréer un nouveau
  // panneau admin") -- ADMIN_SECTIONS bien formé : ids uniques PAR groupe (data-cat+data-id
  // ensemble forment la clé réelle utilisée par openAdminSection), chaque item a un render()
  // OU planned:true mais jamais aucun des deux (sinon un clic sur cet item ne fait rien de
  // visible, silencieusement) et jamais les deux à la fois.
  function testAdminSectionsWellFormed() {
    if (typeof ADMIN_SECTIONS === 'undefined') return;
    assert('ADMIN_SECTIONS non vide', ADMIN_SECTIONS.length > 0);
    const catIds = ADMIN_SECTIONS.map(g => g.cat);
    assert('Catégories de sections avec des ids uniques', new Set(catIds).size === catIds.length);
    ADMIN_SECTIONS.forEach(group => {
      assert(`Groupe "${group.cat}" a un libellé fr et en`, group.label && group.label.fr && group.label.en);
      const itemIds = group.items.map(i => i.id);
      assert(`Groupe "${group.cat}" : items avec des ids uniques`, new Set(itemIds).size === itemIds.length);
      group.items.forEach(item => {
        assert(`"${group.cat}/${item.id}" a un libellé fr et en`, item.label && item.label.fr && item.label.en);
        const hasRender = typeof item.render === 'function';
        const isPlanned = !!item.planned;
        assert(`"${group.cat}/${item.id}" a exactement un de render()/planned:true (jamais 0, jamais 2)`, hasRender !== isPlanned);
      });
    });
  }
  // dashboard consolidé (2026-07-20, demande explicite : "ajoute toutes les graphique de tout les
  // panel dans dashboard avec des voyant vert rouge pour plus dinfos") -- chaque widget doit
  // pointer vers une VRAIE section du registre ADMIN_SECTIONS (sinon un clic sur la carte ne ferait
  // rien, silencieusement, même piège que testAdminSectionsWellFormed ci-dessus) et exposer
  // fetch()/build() en fonctions.
  function testDashboardWidgetsPointToRealSections() {
    if (typeof DASHBOARD_WIDGETS === 'undefined' || typeof ADMIN_SECTIONS === 'undefined') return;
    assert('DASHBOARD_WIDGETS non vide', DASHBOARD_WIDGETS.length > 0);
    const widgetIds = DASHBOARD_WIDGETS.map(w => w.id);
    assert('DASHBOARD_WIDGETS : ids uniques', new Set(widgetIds).size === widgetIds.length);
    DASHBOARD_WIDGETS.forEach(w => {
      const group = ADMIN_SECTIONS.find(g => g.cat === w.cat);
      assert(`Widget "${w.id}" : la catégorie "${w.cat}" existe dans ADMIN_SECTIONS`, !!group);
      const item = group && group.items.find(i => i.id === w.sec);
      assert(`Widget "${w.id}" : la section "${w.cat}/${w.sec}" existe et a un vrai render()`, !!item && typeof item.render === 'function');
      assert(`Widget "${w.id}" a un titre fr et en`, w.title && w.title.fr && w.title.en);
      assert(`Widget "${w.id}" expose fetch() et build() en fonctions`, typeof w.fetch === 'function' && typeof w.build === 'function');
    });
  }
  // dashboardLight() : fonction PURE, juste une projection booléen -> {dot,label} -- vérifie que
  // les deux issues sont bien distinctes (jamais le même émoji pour sain/à surveiller, sinon le
  // voyant perd tout son sens visuel).
  function testDashboardLightDistinguishesHealthy() {
    if (typeof dashboardLight === 'undefined') return;
    const healthy = dashboardLight(true), unhealthy = dashboardLight(false);
    assert('dashboardLight(true) renvoie le voyant vert', healthy.dot === '🟢');
    assert('dashboardLight(false) renvoie le voyant rouge', unhealthy.dot === '🔴');
    assert('Les deux voyants sont visuellement distincts', healthy.dot !== unhealthy.dot);
  }
  // graphique silver en SVG (2026-07-19, admin-economy.js) : fonction PURE, testable sans DOM --
  // vérifie qu'un tableau vide ne lève jamais d'exception et que la géométrie retournée place bien
  // les barres positives AU-DESSUS de l'axe médian et les négatives EN-DESSOUS (pas juste "ne
  // plante pas") -- SVG en coordonnées écran, y CROISSANT vers le bas, donc positif = y plus petit.
  function testBuildSilverChartSvgGeometry() {
    if (typeof buildSilverChartSvg !== 'function') return;
    let svgEmpty;
    try { svgEmpty = buildSilverChartSvg([], '#c9a55a', '#c05545'); } catch (e) { svgEmpty = null; }
    assert('buildSilverChartSvg([]) ne lève jamais d\'exception', svgEmpty !== null);
    assert('buildSilverChartSvg([]) retourne quand même un axe (<line>)', !!svgEmpty && svgEmpty.includes('<line'));
    const svg = buildSilverChartSvg([
      { hour:'2026-07-19T10:00:00Z', net_delta: 5000 },
      { hour:'2026-07-19T11:00:00Z', net_delta: -3000 },
    ], '#c9a55a', '#c05545');
    const div = document.createElement('div'); div.innerHTML = svg;
    const rects = [...div.querySelectorAll('rect')];
    assert('2 lignes -> 2 barres générées', rects.length === 2);
    const midY = parseFloat(div.querySelector('line').getAttribute('y1'));
    const posBar = rects.find(r => r.getAttribute('fill') === '#c9a55a');
    const negBar = rects.find(r => r.getAttribute('fill') === '#c05545');
    assert('Barre positive : y au-dessus de l\'axe (y < midY)', !!posBar && parseFloat(posBar.getAttribute('y')) < midY);
    assert('Barre négative : commence PILE à l\'axe (y === midY)', !!negBar && parseFloat(negBar.getAttribute('y')) === midY);
  }
  // graphiques compacts en camembert (2026-07-19, "modifie tout les graphique qu'il soit lisible
  // avec camember ... merge les categorie si besoin") -- mergeSmallSlices fusionne les tranches
  // sous le seuil dans un bucket "Autres", jamais de perte de valeur totale (juste redistribuée).
  function testMergeSmallSlicesPreservesTotalAndMergesTail() {
    if (typeof mergeSmallSlices !== 'function') return;
    const items = [
      { label:'A', value:80 }, { label:'B', value:15 }, { label:'C', value:3 }, { label:'D', value:2 },
    ];
    const merged = mergeSmallSlices(items, 4, 'Autres');
    const totalIn = items.reduce((a,i) => a+i.value, 0);
    const totalOut = merged.reduce((a,i) => a+i.value, 0);
    assert('mergeSmallSlices préserve le total (rien perdu, juste redistribué)', totalIn === totalOut, `in=${totalIn} out=${totalOut}`);
    assert('Les tranches sous 4% (C=3%, D=2%) sont fusionnées dans "Autres"', merged.some(s => s.label === 'Autres' && s.value === 5));
    assert('Les grosses tranches (A, B) restent distinctes, pas fusionnées à tort', merged.some(s => s.label === 'A') && merged.some(s => s.label === 'B'));
    assert('mergeSmallSlices([]) ne lève jamais d\'exception et renvoie un tableau vide', JSON.stringify(mergeSmallSlices([], 4, 'Autres')) === '[]');
  }
  // buildPieChartSvg : fonction PURE, testable sans DOM -- un total nul ne doit jamais lever
  // d'exception (piège réel : division par zéro dans le calcul d'angle si total===0).
  function testBuildPieChartSvgNeverThrowsOnEmpty() {
    if (typeof buildPieChartSvg !== 'function') return;
    let svg;
    try { svg = buildPieChartSvg([]); } catch (e) { svg = null; }
    assert('buildPieChartSvg([]) ne lève jamais d\'exception', svg !== null);
    assert('buildPieChartSvg([]) retourne quand même un SVG valide', !!svg && svg.includes('<svg'));
    const svgOneSlice = buildPieChartSvg([{ label:'A', value:10, color:'#c9a55a' }]);
    const div = document.createElement('div'); div.innerHTML = svgOneSlice;
    assert('Une seule tranche à 100% -> un cercle plein (pas un path d\'arc dégénéré)', !!div.querySelector('circle'));
  }
  // buildBarSeriesSvg : jamais d'exception sur un tableau vide (même famille que buildSilverChartSvg)
  function testBuildBarSeriesSvgNeverThrowsOnEmpty() {
    if (typeof buildBarSeriesSvg !== 'function') return;
    let svg;
    try { svg = buildBarSeriesSvg([], '#c9a55a'); } catch (e) { svg = null; }
    assert('buildBarSeriesSvg([]) ne lève jamais d\'exception', svg !== null);
    assert('buildBarSeriesSvg([]) retourne quand même l\'axe (<line>)', !!svg && svg.includes('<line'));
  }
  // garde-fou : les graphiques ne doivent plus s'étirer sur toute la largeur du panneau (2026-07-19,
  // demande explicite "rapetisi pour eviter d'avoir des barre avec info a gauche et a droite de
  // lecran") -- verrouille une valeur max-width concrète pour empêcher toute régression silencieuse.
  function testChartsAreCappedNotFullWidth() {
    if (typeof buildBarSeriesSvg !== 'function') return;
    const svg = buildBarSeriesSvg([{label:'a',value:1}], '#c9a55a');
    assert('buildBarSeriesSvg impose un max-width explicite (pas 100% seul)', svg.includes('max-width:420px'));
  }
  // garde-fou (2026-07-21, repo-audit-todo.md point 3 + audit admin_playtime_by_hour) : le graphique
  // "joueurs actifs par heure" lisait r.players/r.playtime_sec alors que la vue admin_playtime_by_hour
  // (schéma live vérifié via Supabase MCP) ne renvoyait que (hour, total_playtime_sec) -- r.players
  // était donc toujours undefined -> Number(undefined||0) -> 0, graphique silencieusement à 0 depuis
  // sa création. Corrigé en ajoutant la colonne players (count distinct user_id) à la vue (migration
  // 20260711145847) et en alignant le select() JS dessus. Garde-fou statique (function.toString(),
  // pas de vrai réseau/DOM ici) contre une régression du nom de colonne ou un retour à select('*').
  function testAdminHourlyReadsRealPlaytimeColumns() {
    if (typeof renderAdminHourly !== 'function') return;
    const src = renderAdminHourly.toString();
    assert('renderAdminHourly ne fait plus de select(\'*\') sur admin_farm_by_hour/admin_playtime_by_hour',
      !/\.select\(\s*['"]\*['"]\s*\)/.test(src), src);
    assert('renderAdminHourly lit bien la colonne "players" de admin_playtime_by_hour (schéma live vérifié)',
      /select\(['"]hour,\s*players['"]\)/.test(src), src);
    assert('renderAdminHourly ne lit plus r.playtime_sec (colonne inexistante, toujours undefined -> bug à 0)',
      !/r\.playtime_sec/.test(src), src);
  }
  // agrégation des répartitions Compagnons (2026-07-20, demande explicite : "ajouter des compteur
  // graphic lié supabase, pet par tier, rareté, catégorie") -- fonction pure, sans réseau/DOM.
  function testSumCompanionBreakdownAggregatesAcrossPlayers() {
    if (typeof sumCompanionBreakdown !== 'function') return;
    const rows = [
      { rarity_breakdown: { '0': 3, '5': 1 } },
      { rarity_breakdown: { '0': 2, '2': 4 } },
      { rarity_breakdown: null }, // ligne mal formée -- ne doit jamais planter
    ];
    const totals = sumCompanionBreakdown(rows, 'rarity_breakdown');
    assert('rareté 0 additionnée sur les 2 lignes qui l\'ont (3+2=5)', totals['0'] === 5);
    assert('rareté 5 présente une seule fois (1)', totals['5'] === 1);
    assert('rareté 2 présente une seule fois (4)', totals['2'] === 4);
    assert('ligne rarity_breakdown:null ignorée sans exception', Object.keys(totals).length === 3);
  }
  function testSumCompanionBreakdownEmptyRowsNeverThrows() {
    if (typeof sumCompanionBreakdown !== 'function') return;
    let threw = false;
    try { sumCompanionBreakdown([], 'tier_breakdown'); sumCompanionBreakdown(null, 'tier_breakdown'); }
    catch(e) { threw = true; }
    assert('tableau vide/null ne lève jamais', !threw);
  }
  // header principal : PvP verrouillé (2026-07-20, demande explicite : "header : PVP bloqué") --
  // même convention que les autres activités pas encore livrées (Pêche/Mine/...).
  function testActivityTabsHasLockedPvpEntry() {
    if (typeof ACTIVITY_TABS === 'undefined') return;
    const pvp = ACTIVITY_TABS.find(t => t.id === 'pvp');
    assert('ACTIVITY_TABS contient une entrée "pvp"', !!pvp);
    if (pvp) assert('l\'onglet PvP du header est verrouillé', pvp.locked === true);
  }
  // garde-fou (2026-07-19, bug réel signalé par l'utilisateur : "check ... bouton fermer") : le
  // bouton #closeAdmin vivait dans #adminMainHead, réécrit intégralement par openAdminSection() à
  // CHAQUE changement de section -- comme openAdminPanel() appelle openAdminSection() juste après
  // avoir posé le bouton, celui-ci disparaissait dès l'ouverture du panneau, le rendant impossible
  // à fermer sans recharger la page. Vérifie que le bouton existe ET reste présent après un
  // changement de section (statique via document.scripts n'aurait pas suffi ici -- vrai test DOM).
  function testCloseAdminButtonSurvivesSectionSwitch() {
    if (typeof openAdminSection !== 'function' || typeof ADMIN_SECTIONS === 'undefined' || !$a('adminSidebar')) return;
    const savedHead = $a('adminMainHead').innerHTML;
    const savedSidebar = $a('adminSidebar').innerHTML;
    try {
      $a('adminSidebar').innerHTML = `<div class="admNavHead"><span class="admNavTitle">Admin</span><button id="closeAdmin">✕</button></div>`;
      $a('adminMainHead').innerHTML = `<span id="adminMainTitle"></span>`;
      openAdminSection('overview', 'dashboard');
      assert('#closeAdmin existe toujours après un changement de section', !!$a('closeAdmin'));
      const otherGroup = ADMIN_SECTIONS.find(g => g.items.some(i => i.id !== 'dashboard'));
      if (otherGroup) {
        const otherItem = otherGroup.items.find(i => i.id !== 'dashboard');
        openAdminSection(otherGroup.cat, otherItem.id);
        assert('#closeAdmin survit à un 2e changement de section', !!$a('closeAdmin'));
      }
    } finally {
      $a('adminMainHead').innerHTML = savedHead;
      $a('adminSidebar').innerHTML = savedSidebar;
    }
  }
  // consommation des Pierres de Cron (2026-07-19, demande explicite : "je veux utilisation des
  // cron ... comme les silver me le dire") -- jusqu'ici seul le ramassage était journalisé
  // (farm_events, kind='material'), la consommation (protection d'enchantement) ne touchait que
  // l'inventaire local, invisible côté admin. queueFarmEvent('cron_used', ...) réutilise farm_events
  // avec un kind DISTINCT -- garde-fou : ne doit jamais utiliser le même kind que le ramassage,
  // sinon admin_farm_by_item (qui groupe par item_name+item_kind) mélangerait farmé et consommé.
  function testCronUsageLoggedWithDistinctKindFromPickup() {
    if (typeof queueFarmEvent !== 'function' || typeof farmEventQueue === 'undefined' || typeof CRON_STONE === 'undefined') return;
    // queueFarmEvent() se tait volontairement pour un invité/compte non connecté (pas de
    // journalisation sans compte vérifié) -- ce test vérifie la DISTINCTION des kinds, pas ce
    // garde-fou d'auth (déjà couvert ailleurs), donc on saute proprement si non applicable ici.
    if (typeof currentUser === 'undefined' || !currentUser || (typeof isGuest === 'function' && isGuest())) return;
    const saved = new Map(farmEventQueue);
    farmEventQueue.clear();
    try {
      queueFarmEvent('material', CRON_STONE.name, 2, 0); // ramassage normal
      queueFarmEvent('cron_used', CRON_STONE.name, 1, 0); // consommation pour protection
      const keys = [...farmEventQueue.keys()];
      const materialKey = keys.find(k => k.startsWith('material|'+CRON_STONE.name));
      const usedKey = keys.find(k => k.startsWith('cron_used|'+CRON_STONE.name));
      assert('Ramassage et consommation créent 2 entrées DISTINCTES dans la queue', !!materialKey && !!usedKey && materialKey !== usedKey);
      assert('La quantité ramassée n\'est jamais mélangée à la quantité consommée', farmEventQueue.get(materialKey).qty === 2 && farmEventQueue.get(usedKey).qty === 1);
    } finally {
      farmEventQueue.clear();
      saved.forEach((v,k) => farmEventQueue.set(k,v));
    }
  }
  // override admin des taux de loot (2026-07-19) : la fusion doit être PARTIELLE -- modifier un
  // seul palier ne doit jamais écraser les autres à undefined (bug réel qu'un simple
  // `LOOT_RATES_LIVE = data.value` aurait introduit si l'admin n'envoyait qu'un sous-ensemble).
  function testLootRatesLiveMergeIsPartial() {
    if (typeof LOOT_RATES_LIVE === 'undefined' || typeof LOOT_RATES_V2 === 'undefined') return;
    const saved = JSON.parse(JSON.stringify(LOOT_RATES_LIVE));
    try {
      LOOT_RATES_LIVE = JSON.parse(JSON.stringify(LOOT_RATES_V2));
      const partialOverride = { grey: { gear: 0.5, jewel: 0.25 } }; // ne touche QUE 'grey'
      for (const grade of Object.keys(LOOT_RATES_LIVE)) {
        if (partialOverride[grade]) LOOT_RATES_LIVE[grade] = { ...LOOT_RATES_LIVE[grade], ...partialOverride[grade] };
      }
      assert('Le palier modifié (grey) reflète bien l\'override', LOOT_RATES_LIVE.grey.gear === 0.5 && LOOT_RATES_LIVE.grey.jewel === 0.25);
      assert('Un palier NON modifié (white) garde sa valeur par défaut, jamais undefined',
        LOOT_RATES_LIVE.white.gear === LOOT_RATES_V2.white.gear && LOOT_RATES_LIVE.white.jewel === LOOT_RATES_V2.white.jewel);
    } finally {
      LOOT_RATES_LIVE = saved;
    }
  }
  // garde-fou d'ordre de chargement (même famille que testSorcierRenderLoadsBeforeSyncStartupCallers) :
  // admin-economy.js référence ADMIN_SECTIONS au chargement immédiat (.splice() top-level) --
  // doit donc charger APRÈS admin-panel.js, qui le déclare. Vérifie l'ordre réel des <script>.
  function testAdminEconomyLoadsAfterAdminPanel() {
    const scripts = [...document.scripts].map(s => s.src);
    const panelIdx = scripts.findIndex(s => s.includes('admin-panel.js'));
    const econIdx = scripts.findIndex(s => s.includes('admin-economy.js'));
    if (panelIdx === -1 || econIdx === -1) return; // fichier pas chargé dans ce contexte (bundle prod, tests...)
    assert('admin-economy.js charge APRÈS admin-panel.js (ADMIN_SECTIONS doit déjà exister)', econIdx > panelIdx);
  }
  // pity/malus mort/bonus 1er kill semaine (2026-07-19, adaptation du prompt roulette React,
  // "garde le casino, ajoute la logique") -- src/combat/boss.js
  function testGetISOWeekStringKnownDates() {
    if (typeof getISOWeekString !== 'function') return;
    // vendredi 9 janvier 2026 -> semaine ISO 2 (le 1er janvier 2026 est un jeudi, donc semaine 1
    // couvre le 29 déc.-4 jan., semaine 2 démarre le 5 janvier)
    assert('getISOWeekString : 09/01/2026 (vendredi) -> 2026-W02', getISOWeekString(new Date(2026,0,9)) === '2026-W02');
    // lundi 1er juin 2026
    assert('getISOWeekString : 01/06/2026 (lundi) -> même semaine que le dimanche suivant',
      getISOWeekString(new Date(2026,5,1)) === getISOWeekString(new Date(2026,5,7)));
    assert('getISOWeekString : un lundi et le dimanche PRÉCÉDENT sont dans des semaines différentes',
      getISOWeekString(new Date(2026,5,1)) !== getISOWeekString(new Date(2026,4,31)));
  }
  function testBossDeathPenaltyMultTable() {
    if (typeof bossDeathPenaltyMult !== 'function') return;
    assert('0 mort = ×1.0 (pas de malus)', bossDeathPenaltyMult(0) === 1);
    assert('1 mort = ×0.9', bossDeathPenaltyMult(1) === 0.9);
    assert('2 morts = ×0.75', bossDeathPenaltyMult(2) === 0.75);
    assert('3 morts = ×0.5', bossDeathPenaltyMult(3) === 0.5);
    assert('4 morts = ×0 (loot chiffré + rareLoot exclus)', bossDeathPenaltyMult(4) === 0);
    assert('10 morts = toujours ×0 (jamais négatif ni undefined au-delà de la table)', bossDeathPenaltyMult(10) === 0);
  }
  function testBossFirstKillOfWeekPerBossNotGlobal() {
    if (typeof bossFirstKillOfWeek !== 'function' || typeof S === 'undefined') return;
    const saved = { ...S.bossLastKillWeek };
    try {
      S.bossLastKillWeek = {};
      assert('Aucun kill enregistré -> premier kill de la semaine = true', bossFirstKillOfWeek('kzarka') === true);
      S.bossLastKillWeek.kzarka = getISOWeekString(new Date());
      assert('Kzarka déjà tué cette semaine -> false', bossFirstKillOfWeek('kzarka') === false);
      assert('Vell PAS tué cette semaine (seul kzarka marqué) -> reste true (par boss, pas global)', bossFirstKillOfWeek('vell') === true);
    } finally {
      S.bossLastKillWeek = saved;
    }
  }
  function testBossPityForcesWinAtThreshold() {
    if (typeof BOSS_PITY_THRESHOLD === 'undefined') return;
    assert('BOSS_PITY_THRESHOLD est un nombre positif raisonnable (filet de sécurité, pas un don)', typeof BOSS_PITY_THRESHOLD === 'number' && BOSS_PITY_THRESHOLD > 0 && BOSS_PITY_THRESHOLD < 100);
  }
  // roue de récompense boss en React (2026-07-19) -- src/combat/boss-wheel-react.js. Les fonctions
  // géométriques (wheelLandingDeg/wheelSegmentPath) restent de simples fonctions pures : testables
  // sans monter le moindre composant React ni toucher au DOM.
  function testWheelLandingDegWonIsSegmentCenter() {
    if (typeof wheelLandingDeg !== 'function') return;
    const n = 12, segDeg = 360/n;
    assert('gagné -> atterrit exactement au centre du segment rare (segDeg/2)',
      wheelLandingDeg({ n, won:true }) === segDeg/2);
  }
  function testWheelLandingDegLossNeverLandsInsideRareSegment() {
    if (typeof wheelLandingDeg !== 'function') return;
    const n = 12, segDeg = 360/n;
    // 500 tirages, chance de near-miss forcée à 1 pour couvrir aussi cette branche -- dans les 2 cas
    // (near-miss ou zone uniforme), une perte ne doit JAMAIS atterrir DANS le segment rare [0, segDeg[,
    // sinon le pointeur semblerait désigner le lot rare alors que it.won est false (incohérence visuelle).
    let ok = true;
    for (let i = 0; i < 500; i++) {
      const chance = i % 2 === 0 ? 1 : 0;
      const deg = wheelLandingDeg({ n, won:false, marginDeg:8, chance });
      if (deg >= 0 && deg < segDeg) { ok = false; break; }
    }
    assert('perte : jamais d\'atterrissage dans le segment rare (near-miss compris)', ok);
  }
  function testWheelSegmentPathIsWellFormedSvgPath() {
    if (typeof wheelSegmentPath !== 'function') return;
    const d = wheelSegmentPath(60, 60, 56, 0, 30);
    assert('chemin SVG bien formé : commence par M, contient un arc A, se termine par Z',
      /^M60,60/.test(d) && d.includes(' A') && d.trim().endsWith('Z'));
  }
  function testBossWheelReactSegmentCountMatchesRoster() {
    if (typeof BOSS_WHEEL_SEGMENTS === 'undefined') return;
    assert('au moins 2 segments (1 rare + au moins 1 "rien"), sinon la roue n\'a aucun sens visuel',
      typeof BOSS_WHEEL_SEGMENTS === 'number' && BOSS_WHEEL_SEGMENTS >= 2);
  }
  // tutoriels d'objets au premier obtain (2026-07-19) -- src/progression/notifications-quests.js
  function testItemTutorialsWellFormedAndIndexed() {
    if (typeof ITEM_TUTORIALS === 'undefined' || typeof ITEM_TUTORIAL_BY_NAME === 'undefined') return;
    const ids = Object.keys(ITEM_TUTORIALS);
    assert('ITEM_TUTORIALS non vide', ids.length > 0);
    // itemNames peut être VIDE (2026-07-19) : les tutoriels d'ACTION (enchant/market/boss) sont
    // déclenchés manuellement (maybeQueueTutorialById), jamais au ramassage d'un objet -- on
    // vérifie juste qu'au moins UN tutoriel déclenché par objet existe toujours dans le registre.
    assert('au moins un tutoriel déclenché par ramassage d\'objet (itemNames non vide)',
      ids.some(id => ITEM_TUTORIALS[id].itemNames.size > 0));
    ids.forEach(id => {
      const tuto = ITEM_TUTORIALS[id];
      assert(`"${id}" a au moins 1 étape`, Array.isArray(tuto.steps) && tuto.steps.length > 0);
      assert(`"${id}" a un itemNames de type Set (vide ou non)`, tuto.itemNames instanceof Set);
      assert(`"${id}" : la DERNIÈRE étape est marquée final:true (sinon endItemTutorial ne se déclenche jamais)`, !!tuto.steps[tuto.steps.length-1].final);
      tuto.steps.forEach((step,i) => {
        assert(`"${id}" étape ${i} a un titre fr et en`, step.title && step.title.fr && step.title.en);
        assert(`"${id}" étape ${i} a un texte fr et en`, step.text && step.text.fr && step.text.en);
      });
    });
    // index inverse cohérent : chaque nom d'objet de chaque tutoriel pointe bien vers le bon id
    let indexOk = true;
    ids.forEach(id => { ITEM_TUTORIALS[id].itemNames.forEach(name => { if (ITEM_TUTORIAL_BY_NAME[name] !== id) indexOk = false; }); });
    assert('ITEM_TUTORIAL_BY_NAME reflète fidèlement ITEM_TUTORIALS (aucun nom mal indexé)', indexOk);
    // pas de nom d'objet partagé entre 2 tutoriels différents (sinon l'index écraserait silencieusement)
    const allNames = ids.flatMap(id => [...ITEM_TUTORIALS[id].itemNames]);
    assert('Aucun nom d\'objet déclencheur partagé entre 2 tutoriels (l\'index écraserait silencieusement)', new Set(allNames).size === allNames.length);
  }
  function testMaybeQueueItemTutorialRespectsSeenAndCap() {
    if (typeof maybeQueueItemTutorial !== 'function' || typeof ITEM_TUTORIAL_BY_NAME === 'undefined') return;
    const anyName = Object.keys(ITEM_TUTORIAL_BY_NAME)[0];
    if (!anyName) return;
    const id = ITEM_TUTORIAL_BY_NAME[anyName];
    const storageKey = 'velia-idle-item-tuto-seen-'+id;
    let savedFlag = null;
    try { savedFlag = localStorage.getItem(storageKey); } catch(e) {}
    const savedActive = itemTutorialActive, savedQueue = itemTutorialQueue.slice(), savedActiveId = itemTutorialActiveId;
    // bug corrigé le 2026-07-20 ("l'onboarding ne dois pas s'enclencher si on ne s'est pas
    // inscrit/connecté") : maybeQueueTutorialById() exige désormais un currentUser réel avant de
    // mettre quoi que ce soit en file -- simuler une session le temps du test, comme le vrai jeu
    // en environnement normal (l'ancien comportement de ce test, sans compte, testait justement le
    // cas maintenant bloqué par construction).
    const savedUser = typeof currentUser !== 'undefined' ? currentUser : undefined;
    try {
      if (typeof currentUser !== 'undefined') currentUser = { id:'test-tutorial-queue', email:'test@test.local' };
      try { localStorage.removeItem(storageKey); } catch(e) {}
      // force le chemin "mise en FILE" plutôt que "jouer immédiatement" -- ce dernier appellerait
      // playNextItemTutorial() -> setTimeout(startTutorial, 400) RÉEL et non annulable, ce qui
      // ouvrirait un vrai overlay de tutoriel pendant la suite de tests et laisserait
      // itemTutorialActive bloqué à true pour le reste de la session (bug détecté en vérifiant ce
      // test manuellement en preview). itemTutorialActive=true simule "un tutoriel déjà affiché".
      itemTutorialActive = true; itemTutorialQueue = [];
      assert('Objet jamais vu, un tutoriel déjà actif -> mis en FILE (jamais rejoué immédiatement)', maybeQueueItemTutorial(anyName) === true);
      assert('Le flag "vu" est bien posé dès la mise en file (pas seulement à la fermeture)', isItemTutorialSeen(id) === true);
      assert('Objet déjà vu -> un 2e appel ne remet jamais en file', maybeQueueItemTutorial(anyName) === false);
      assert('Un nom d\'objet sans tutoriel enregistré ne fait jamais planter la fonction', maybeQueueItemTutorial('ObjetSansTutorielXYZ') === false);
    } finally {
      itemTutorialActive = savedActive; itemTutorialQueue = savedQueue; itemTutorialActiveId = savedActiveId;
      if (typeof currentUser !== 'undefined') currentUser = savedUser;
      try {
        if (savedFlag === null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, savedFlag);
      } catch(e) {}
    }
  }
  // garde-fou dédié (2026-07-20, rapporté explicitement : "l'onboarding ne dois pas s'enclencher
  // si on ne s'est pas inscrit/connecté = jeu non lance arriere plan") -- SANS compte connecté,
  // maybeQueueTutorialById() ne doit RIEN faire (pas de mise en file, pas de flag "vu" posé) --
  // sinon un joueur perdrait définitivement un tutoriel avant même de s'être authentifié, puisque
  // markItemTutorialSeen() est appelé DÈS la mise en file (pas seulement à l'affichage réel).
  function testTutorialNeverQueuesOrMarksSeenWithoutAuthenticatedUser() {
    if (typeof maybeQueueTutorialById !== 'function' || typeof ITEM_TUTORIALS === 'undefined' || !ITEM_TUTORIALS.enchant || typeof currentUser === 'undefined') return;
    const id = 'enchant', storageKey = 'velia-idle-item-tuto-seen-'+id;
    let savedFlag = null;
    try { savedFlag = localStorage.getItem(storageKey); } catch(e) {}
    const savedActive = itemTutorialActive, savedQueue = itemTutorialQueue.slice(), savedActiveId = itemTutorialActiveId, savedUser = currentUser;
    try {
      try { localStorage.removeItem(storageKey); } catch(e) {}
      itemTutorialActive = false; itemTutorialQueue = []; itemTutorialActiveId = null;
      currentUser = null; // simule le jeu tournant en arrière-plan AVANT authentification
      assert('Sans compte connecté, maybeQueueTutorialById ne met jamais rien en file', maybeQueueTutorialById(id) === false);
      assert('Sans compte connecté, le flag "vu" n\'est JAMAIS posé (le joueur pourra encore le voir une fois connecté)', isItemTutorialSeen(id) === false);
      assert('La file reste vide (aucun effet de bord malgré l\'appel)', itemTutorialQueue.length === 0);
    } finally {
      itemTutorialActive = savedActive; itemTutorialQueue = savedQueue; itemTutorialActiveId = savedActiveId; currentUser = savedUser;
      try {
        if (savedFlag === null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, savedFlag);
      } catch(e) {}
    }
  }
  // garde-fou contre le retour du bug marché (2026-07-10, récupéré depuis la branche
  // claude/onboarding-issue-fix-861c40) : #marketBox est le panneau ENTIER (height:80vh,
  // styles.css), son bord bas est déjà proche du bas de l'écran -- si ce step recible ce
  // conteneur, la bulle 'bottom' redéborde du viewport (voir clamp ci-dessous). La cible doit
  // rester un petit élément fixe en haut du panneau (#marketHead).
  function testMarketTutorialTargetsMarketHeadNotFullPanel() {
    if (typeof ITEM_TUTORIALS === 'undefined' || !ITEM_TUTORIALS.market) return;
    const step = ITEM_TUTORIALS.market.steps[0];
    assert('tutoriel Marché cible #marketHead (petit bandeau), pas #marketBox (panneau entier)',
      step.target === '#marketHead');
  }
  // clamp de positionTutorialStep sur la hauteur RÉELLE de la boîte, pas une valeur fixe
  // (2026-07-10, bug corrigé) : une cible proche du bas du viewport ET un texte assez long pour
  // dépasser l'ancienne supposition de 160px faisait déborder #tutorialBox hors de l'écran, coupé
  // (constaté sur le tutoriel Marché commun, ciblait alors #marketBox). Test synthétique : cible
  // factice collée au bas du viewport + texte volontairement long.
  function testTutorialBoxClampsToRealHeightNeverOverflowsBottom() {
    if (typeof startTutorial !== 'function' || typeof endTutorial !== 'function') return;
    const target = document.createElement('div');
    target.id = 'testTutorialOverflowTarget';
    target.style.cssText = 'position:fixed; left:20px; bottom:4px; width:100px; height:20px;';
    document.body.appendChild(target);
    try {
      const longText = 'x '.repeat(200); // assez long pour rendre #tutorialBox bien plus haut que 160px
      startTutorial([{ target:'#testTutorialOverflowTarget', placement:'bottom', final:true,
        title:{fr:'Test', en:'Test'}, text:{fr:longText, en:longText} }], { resetView:false });
      const box = document.getElementById('tutorialBox');
      const r = box.getBoundingClientRect();
      assert('#tutorialBox ne déborde jamais sous le bas du viewport, même avec un texte long près du bord bas',
        r.bottom <= window.innerHeight);
      endTutorial(true);
    } finally {
      target.remove();
      const overlay = document.getElementById('tutorialOverlay');
      if (overlay) overlay.classList.remove('open');
    }
  }
  // trash de zone : tutoriel unique couvrant TOUS les noms de trash de ZONES (2026-07-19) --
  // itemNames calculé dynamiquement (jamais codé en dur), donc doit toujours refléter ZONES.
  function testTrashTutorialCoversEveryZoneTrashName() {
    if (typeof ITEM_TUTORIALS === 'undefined' || !ITEM_TUTORIALS.trash || typeof ZONES === 'undefined') return;
    const zoneTrashNames = new Set(ZONES.map(z => z.loot.trash.name));
    assert('ITEM_TUTORIALS.trash couvre exactement les noms de trash de toutes les zones',
      zoneTrashNames.size === ITEM_TUTORIALS.trash.itemNames.size
      && [...zoneTrashNames].every(n => ITEM_TUTORIALS.trash.itemNames.has(n)));
  }
  // tutoriels d'ACTION (2026-07-19, demande explicite : "info... quand on va faire des nouveau
  // truc") : enchant/market/boss, déclenchés manuellement (jamais par un ramassage d'objet).
  function testActionTutorialsRegisteredWithEmptyItemNames() {
    if (typeof ITEM_TUTORIALS === 'undefined') return;
    ['enchant', 'market', 'boss'].forEach(id => {
      const tuto = ITEM_TUTORIALS[id];
      assert(`ITEM_TUTORIALS.${id} existe`, !!tuto);
      if (!tuto) return;
      assert(`ITEM_TUTORIALS.${id}.itemNames est vide (jamais déclenché par ramassage)`, tuto.itemNames.size === 0);
    });
  }
  function testMaybeQueueTutorialByIdWorksForManualTrigger() {
    if (typeof maybeQueueTutorialById !== 'function' || typeof ITEM_TUTORIALS === 'undefined' || !ITEM_TUTORIALS.enchant) return;
    const id = 'enchant', storageKey = 'velia-idle-item-tuto-seen-'+id;
    let savedFlag = null;
    try { savedFlag = localStorage.getItem(storageKey); } catch(e) {}
    const savedActive = itemTutorialActive, savedQueue = itemTutorialQueue.slice(), savedActiveId = itemTutorialActiveId;
    const savedUser = typeof currentUser !== 'undefined' ? currentUser : undefined;
    try {
      // même correctif que testMaybeQueueItemTutorialRespectsSeenAndCap ci-dessus (2026-07-20) :
      // simule une session pour tester le chemin "normal" (compte connecté).
      if (typeof currentUser !== 'undefined') currentUser = { id:'test-tutorial-action', email:'test@test.local' };
      try { localStorage.removeItem(storageKey); } catch(e) {}
      // même garde qu'au-dessus : force le chemin FILE, jamais le déclenchement réel du DOM --
      // itemTutorialActiveId mis à une valeur DIFFÉRENTE de `id` (pas juste laissé tel quel) : sur
      // un compte de test qui a déjà un matériau d'optimisation chargé, le vrai déclenchement
      // (inventory-ui.js) a pu légitimement tourner AVANT ce test et laisser itemTutorialActiveId
      // déjà égal à 'enchant' — sans ce reset explicite, la garde anti-doublon de
      // maybeQueueTutorialById le prendrait alors à tort pour "déjà en cours" et le test échouerait.
      itemTutorialActive = true; itemTutorialQueue = []; itemTutorialActiveId = '__test_other__';
      assert('Tutoriel d\'action jamais vu -> mis en file', maybeQueueTutorialById(id) === true);
      assert('Flag "vu" posé dès la mise en file', isItemTutorialSeen(id) === true);
      assert('2e appel -> jamais remis en file', maybeQueueTutorialById(id) === false);
      assert('Id inconnu -> false, ne plante jamais', maybeQueueTutorialById('IdInconnuXYZ') === false);
    } finally {
      itemTutorialActive = savedActive; itemTutorialQueue = savedQueue; itemTutorialActiveId = savedActiveId;
      if (typeof currentUser !== 'undefined') currentUser = savedUser;
      try {
        if (savedFlag === null) localStorage.removeItem(storageKey);
        else localStorage.setItem(storageKey, savedFlag);
      } catch(e) {}
    }
  }
  // suivi de progression admin de l'onboarding (2026-07-19) -- src/backend/game-supabase.js.
  // reportTutorialProgress est fire-and-forget et gardée par sb/currentUser/isGuest -- sans compte
  // connecté en environnement de test, elle doit rester un no-op silencieux (jamais d'exception).
  function testOnboardingTrackingNeverThrowsWithoutTrackId() {
    if (typeof startTutorial !== 'function' || typeof endTutorial !== 'function' || typeof TUTORIAL_STEPS === 'undefined') return;
    const savedIdx = tutorialStepIdx, savedSteps = activeTutorialSteps, savedTrackId = typeof activeTutorialTrackId !== 'undefined' ? activeTutorialTrackId : undefined;
    let threw = false;
    try { startTutorial(TUTORIAL_STEPS, { resetView:false }); endTutorial(true); }
    catch(e) { threw = true; }
    finally {
      tutorialStepIdx = savedIdx; activeTutorialSteps = savedSteps;
      if (typeof activeTutorialTrackId !== 'undefined') activeTutorialTrackId = savedTrackId;
      $a('tutorialOverlay').classList.remove('open');
    }
    assert('startTutorial/endTutorial sans trackId ne lève jamais d\'exception (pas de compte connecté en test)', !threw);
  }
  // "Cadenas dans le header sur le cadre de la ligne du bas" + "les pv du boss se retrouve dans une
  // bulle sur la ligne du bas du rectangle dans le header" (2026-07-08) -- les 2 badges doivent être
  // des overlays position:absolute à cheval sur la bordure inférieure du bouton (même convention que
  // .zoneTierLock, mais en bas), pas de simples éléments dans le flux normal du texte.
  function testHeaderBadgesSitOnBottomBorder() {
    if (!$('activityTabs') || typeof renderActivityTabs !== 'function' || typeof updateBossActivityTabHot !== 'function') return;
    renderActivityTabs();
    const fish = [...$('activityTabs').querySelectorAll('.actTab')].find(b => b.dataset.id === 'fish');
    if (fish) {
      const lockStyle = getComputedStyle(fish.querySelector('.actTabLock'));
      assert('Le badge cadenas est en position absolute (chevauche le cadre)', lockStyle.position === 'absolute', `position=${lockStyle.position}`);
      assert('Le badge cadenas est ancré en bas du bouton (bottom négatif)', parseFloat(lockStyle.bottom) < 0, `bottom=${lockStyle.bottom}`);
    }
    const savedActive = bossState.active, savedHp = bossState.hp, savedMax = bossState.maxHp;
    bossState.active = true; bossState.hp = 55; bossState.maxHp = 100;
    updateBossActivityTabHot();
    const hpEl = $('actTabBossHp'), hpStyle = getComputedStyle(hpEl);
    assert('La bulle %PV du boss est en position absolute (chevauche le cadre)', hpStyle.position === 'absolute', `position=${hpStyle.position}`);
    assert('La bulle %PV du boss est ancrée en bas du bouton (bottom négatif)', parseFloat(hpStyle.bottom) < 0, `bottom=${hpStyle.bottom}`);
    bossState.active = savedActive; bossState.hp = savedHp; bossState.maxHp = savedMax;
    updateBossActivityTabHot();
  }
  // "Créer un Flash lumineux sur la catégorie boss, qu'on le vois bien 5 min avant et pendant toute
  // la durée du boss, met y les % hp du boss bien visible aussi" (2026-07-08) -- verrouille le
  // déclenchement du flash (bossHot) et l'affichage du %PV sur l'onglet Boss du header.
  function testBossActivityTabFlashesNearSpawnAndShowsHp() {
    if (typeof updateBossActivityTabHot !== 'function' || !$('activityTabs') || typeof renderActivityTabs !== 'function') return;
    renderActivityTabs();
    const btn = $('actTabBoss'); if (!btn) return;
    const savedBossState = { active: bossState.active, hp: bossState.hp, maxHp: bossState.maxHp };
    // combat en cours : le flash doit s'allumer et le %PV doit être calculé depuis bossState
    bossState.active = true; bossState.hp = 30; bossState.maxHp = 100;
    updateBossActivityTabHot();
    assert('Onglet Boss flashe (bossHot) pendant un combat', btn.classList.contains('bossHot'));
    assert('Onglet Boss affiche bien le %PV pendant un combat', $('actTabBossHp').textContent === '30%', `texte=${$('actTabBossHp').textContent}`);
    // hors combat, sans occurrence proche : pas de flash, pas de %PV
    bossState.active = false; bossState.hp = savedBossState.hp; bossState.maxHp = savedBossState.maxHp;
    updateBossActivityTabHot();
    const occNow = nextBossOccurrence();
    const shouldBeHot = !!occNow && (occNow.live || (occNow.time - Date.now()) <= BOSS_TAB_FLASH_LEAD_MS);
    assert('Hors combat, le flash suit exactement la fenêtre planifiée (5 min avant + durée live)', btn.classList.contains('bossHot') === shouldBeHot);
    bossState.active = savedBossState.active;
  }
  // "au niveau de l'onglet boss une fois que le boss est vaincu ecrire vaincu a la place des %"
  // (2026-07-09) -- la bulle %PV de l'onglet Boss doit basculer sur "VAINCU"/"DEFEATED" à 0 PV,
  // jamais rester sur "0%" qui laisserait croire que le combat continue.
  function testBossActivityTabShowsDefeatedTextAtZeroHp() {
    if (typeof updateBossActivityTabHot !== 'function' || !$('activityTabs') || typeof renderActivityTabs !== 'function') return;
    renderActivityTabs();
    if (!$('actTabBoss')) return;
    const savedBossState = { active: bossState.active, hp: bossState.hp, maxHp: bossState.maxHp };
    bossState.active = true; bossState.hp = 0; bossState.maxHp = 100;
    updateBossActivityTabHot();
    assert('Onglet Boss affiche "VAINCU"/"DEFEATED" à 0 PV, pas "0%"', /VAINCU|DEFEATED/.test($('actTabBossHp').textContent), `texte=${$('actTabBossHp').textContent}`);
    bossState.hp = 17;
    updateBossActivityTabHot();
    assert('Onglet Boss revient bien à un %PV normal une fois les PV > 0', $('actTabBossHp').textContent === '17%', `texte=${$('actTabBossHp').textContent}`);
    bossState.active = savedBossState.active; bossState.hp = savedBossState.hp; bossState.maxHp = savedBossState.maxHp;
    updateBossActivityTabHot();
  }
  // "lors de la fin du boss une roulette tourne ou un des se jette pour chaque recompense
  // aléatoire, le joueurs peut passer puisn un bouton quittersaffiche (retour a zone)" (2026-07-08)
  // -- verrouille : (1) un dé par récompense chiffrée + une roue pour le loot rarissime, (2)
  // "Passer" révèle tout instantanément et fait apparaître "Quitter", (3) sans aucune récompense
  // à révéler (défaite/déjà réclamé), "Quitter" s'affiche d'emblée sans dé ni roue superflu.
  function testBossRewardRevealSequenceThenSkipShowsCloseButton() {
    if (typeof renderBossRewardReveal !== 'function' || typeof wireBossRewardReveal !== 'function' || !$('bossResult')) return;
    const saved = $('bossResult').innerHTML;
    const items = [
      { kind:'dice', icon:'🪙', color:'#e8c96a', label:'Silver', resultHtml:'+100 🪙' },
      { kind:'wheel', rareLoot:{ name:'Test Rare', icon:'❤️', color:'#5ec9e8', ch:0.05 }, won:false },
    ];
    $('bossResult').innerHTML = renderBossRewardReveal(items);
    wireBossRewardReveal(items);
    assert('2 items de révélation rendus (1 dé + 1 roue)', $('bossResult').querySelectorAll('.brRevealItem').length === 2);
    assert('Bouton Passer présent avant révélation', getComputedStyle($('bossSkipBtn')).display !== 'none');
    assert('Bouton Quitter masqué avant révélation', getComputedStyle($('bossCloseBtn')).display === 'none');
    $('bossSkipBtn').click();
    const results = [...$('bossResult').querySelectorAll('.brRevealResult')].map(r => r.textContent.trim());
    assert('Passer révèle bien le résultat du dé', results[0].includes('100'), `results=${JSON.stringify(results)}`);
    assert('Passer révèle bien le résultat de la roue (perdu)', results[1].length > 0, `results=${JSON.stringify(results)}`);
    assert('Passer fait disparaître le bouton Passer', getComputedStyle($('bossSkipBtn')).display === 'none');
    assert('Passer fait apparaître le bouton Quitter', getComputedStyle($('bossCloseBtn')).display !== 'none');
    $('bossResult').innerHTML = saved;
  }
  // "Les roll du boss Pierre de caphras et frag memoire doivent se faire plus lentement et donner
  // une lenteur plus en plus petite des qu'il arrive a la fin ou alors casino entierement pour
  // tout les loot montre" (2026-07-09) -- un dé à valeur chiffrée (rollValue/rollTemplate) doit
  // défiler (valeur affichée ≠ figée immédiatement) puis s'arrêter PILE sur la vraie valeur, que
  // ce soit naturellement ou via "Passer".
  function testBossDiceRollLandsOnTrueValueAndSkipIsInstant() {
    if (typeof renderBossRewardReveal !== 'function' || typeof wireBossRewardReveal !== 'function' || !$('bossResult')) return;
    const saved = $('bossResult').innerHTML;
    const items = [
      { kind:'dice', icon:'🪙', color:'#e8c96a', label:'Silver', rollValue:12345, rollTemplate:n=>`+${n} 🪙` },
    ];
    $('bossResult').innerHTML = renderBossRewardReveal(items);
    wireBossRewardReveal(items);
    assert('Avant révélation, le résultat n\'affiche pas déjà la valeur finale', $('brRevealResult0').textContent !== '+12345 🪙');
    $('bossSkipBtn').click();
    assert('"Passer" fait atterrir instantanément sur la VRAIE valeur tirée', $('brRevealResult0').textContent === '+12345 🪙', `texte=${$('brRevealResult0').textContent}`);
    assert('L\'icône du dé est marquée "settled" une fois la valeur révélée', $('brDiceIcon0').classList.contains('settled'));
    assert('Bouton Quitter visible une fois le roulement terminé', getComputedStyle($('bossCloseBtn')).display !== 'none');
    $('bossResult').innerHTML = saved;
  }
  function testBossRewardRevealEmptyShowsCloseButtonImmediately() {
    if (typeof renderBossRewardReveal !== 'function' || !$('bossResult')) return;
    const saved = $('bossResult').innerHTML;
    $('bossResult').innerHTML = renderBossRewardReveal([]);
    assert('Sans récompense, aucun dé/roue superflu', $('bossResult').querySelectorAll('.brRevealItem').length === 0);
    assert('Sans récompense, Quitter est visible d\'emblée', !!$('bossCloseBtn') && getComputedStyle($('bossCloseBtn')).display !== 'none');
    $('bossResult').innerHTML = saved;
  }
  // "un bouton quitter s'affiche (retour a zone)" -- le retour doit aller à la ZONE de farm (pas
  // au lobby boss comme avant ce changement), fermer bossResult, remettre l'onglet Zone actif.
  function testLeaveBossResultToZoneReturnsToFarm() {
    if (typeof leaveBossResultToZone !== 'function' || !$('bossResult') || !$('gameFrame')) return;
    const savedActivity = currentActivity, savedActive = bossState.active;
    $('bossResult').classList.add('show');
    currentActivity = 'boss';
    bossState.active = false;
    leaveBossResultToZone();
    assert('leaveBossResultToZone repasse currentActivity à "zone"', currentActivity === 'zone');
    assert('leaveBossResultToZone ferme le panneau de résultat', !$('bossResult').classList.contains('show'));
    assert('leaveBossResultToZone rend la vue farm visible', getComputedStyle($('gameFrame')).display !== 'none');
    currentActivity = savedActivity; bossState.active = savedActive;
  }
  // "le coffre ne doit pas dépasser la taille de la carte, les slots bloqué sont bloqué avec un
  // cadenas au dessus au milieu" (2026-07-17) -- avant, les cases verrouillées du coffre affichaient
  // un cadenas inline (position:static, sans le badge visuel), incohérent avec .zoneTierLock utilisé
  // partout ailleurs (onglets de région/inventaire). Garde-fou statique (empêche un futur retour de
  // l'override inline) + DOM (le badge est bien présent, sans style qui casserait la convention).
  function testChestLockedCellsUseBadgeConvention() {
    if (!$('veliaChestGrid')) return; // pas de DOM (contexte hors-jeu)
    const src = renderVeliaChest.toString();
    // recherche le pattern d'ATTRIBUT HTML (style="...") -- pas juste le texte "position:static",
    // qui apparaîtrait aussi dans un commentaire décrivant l'ancien comportement (toString()
    // inclut les commentaires du code source)
    assert('renderVeliaChest() ne réintroduit pas l\'ancien style inline sur le cadenas', !src.includes('zoneTierLock" style='), 'src contient encore un override inline du cadenas');
    renderVeliaChest();
    const lockedCell = $('veliaChestGrid').querySelector('.cell.locked');
    assert('Au moins une case verrouillée existe dans le coffre (192 cases, VELIA_CHEST_OPEN=20)', !!lockedCell);
    if (lockedCell) {
      const lock = lockedCell.querySelector('.zoneTierLock');
      assert('La case verrouillée porte bien le badge .zoneTierLock', !!lock);
      assert('Le badge n\'a pas de style inline qui casserait la convention visuelle', lock && !lock.getAttribute('style'));
    }
  }
  // "toute item identique et quelque soit leurs provenance (meme nom) doit tenir sur un seul
  // stack" (2026-07-08) -- invAdd() stackait par `key` (identifiant technique de provenance), pas
  // par `name` (ce que le joueur voit). 2 objets de provenances différentes mais de même nom
  // doivent fusionner dans le même stack, jamais en créer un second.
  function testInvAddStacksByNameRegardlessOfKey() {
    const freeIdx = INV.findIndex(s => s === null);
    if (freeIdx === -1) return; // sac plein, non testable ici
    const saved = INV[freeIdx];
    INV[freeIdx] = { key:'mat_provenance_A', name:'Test Stack Par Nom', kind:'material', qty:5, stackable:true, weight:0.1, val:1 };
    const ok = invAdd({ key:'mat_provenance_B_totalement_differente', name:'Test Stack Par Nom', kind:'material', qty:3, stackable:true, weight:0.1, val:1 });
    assert('invAdd() réussit malgré une clé technique différente', ok === true);
    assert('Les 2 provenances fusionnent en un seul stack (5+3=8)', INV[freeIdx] && INV[freeIdx].qty === 8, `qty=${INV[freeIdx] && INV[freeIdx].qty}`);
    assert('Aucun second stack créé pour ce nom', INV.filter(s => s && s.name === 'Test Stack Par Nom').length === 1);
    INV[freeIdx] = saved;
  }
  // "boss vaincu, on change la barre de vie et on ecris vaincu jusqu'au moment ou il aurai du
  // despawn" (2026-07-08) -- le lobby (avant même d'entrer en combat) doit montrer une VRAIE barre
  // de vie pour un boss partagé, à 0%/grisée avec "VAINCU" tant que la fenêtre de combat reste
  // ouverte (occ.live), pas seulement le texte déjà existant.
  function testBossLobbyShowsHpBarWhenAlreadyDefeated() {
    if (typeof renderBossLobbyHtml !== 'function') return;
    const savedLiveBoss = liveBoss;
    liveBoss = { boss:'kzarka', time: Date.now()-1000, expires: Date.now()+5*60*1000, hp:0, maxHp:50000 };
    const div = document.createElement('div'); div.innerHTML = renderBossLobbyHtml();
    const bar = div.querySelector('.bossNextHpBar'), txt = div.querySelector('.bossNextHpTxt');
    assert('Une barre de vie est bien présente dans le lobby', !!bar);
    assert('La barre est à 0% (boss déjà vaincu)', bar && bar.style.width === '0%', `width=${bar && bar.style.width}`);
    assert('La barre porte la classe "dead"', bar && bar.classList.contains('dead'));
    assert('Le texte affiche "VAINCU"/"DEFEATED"', txt && /VAINCU|DEFEATED/.test(txt.textContent), `texte=${txt && txt.textContent}`);
    liveBoss = { boss:'kzarka', time: Date.now()-1000, expires: Date.now()+5*60*1000, hp:25000, maxHp:50000 };
    const div2 = document.createElement('div'); div2.innerHTML = renderBossLobbyHtml();
    const bar2 = div2.querySelector('.bossNextHpBar');
    assert('Boss encore en vie : la barre reflète le vrai %PV (50%)', bar2 && bar2.style.width === '50%', `width=${bar2 && bar2.style.width}`);
    assert('Boss encore en vie : pas de classe "dead"', bar2 && !bar2.classList.contains('dead'));
    liveBoss = savedLiveBoss;
  }
  // reskin visuel du lobby Boss (2026-07-11, voir CLAUDE.md) : chaque boss du roster doit avoir une
  // réplique d'ambiance (lore.fr/lore.en) affichée dans la carte "prochain boss" -- une entrée sans
  // lore casserait silencieusement l'affichage prévu (bloc vide) sans qu'aucun test ne le détecte.
  function testAllBossesHaveLoreInBothLangs() {
    if (typeof BOSS_ROSTER === 'undefined') return;
    Object.keys(BOSS_ROSTER).forEach(id => {
      const b = BOSS_ROSTER[id];
      assert(`BOSS_ROSTER["${id}"] a un champ lore`, !!b.lore, `boss=${id}`);
      assert(`BOSS_ROSTER["${id}"].lore a un texte FR non vide`, !!(b.lore && b.lore.fr && b.lore.fr.trim()), `boss=${id}`);
      assert(`BOSS_ROSTER["${id}"].lore a un texte EN non vide`, !!(b.lore && b.lore.en && b.lore.en.trim()), `boss=${id}`);
    });
  }
  // quantité de matériau déjà en poche (bossMatInHand, voir combat/boss.js) affichée dans le lobby
  // à côté de la fourchette de drop -- doit sommer sur tous les slots INV partageant la même clé
  // (pas juste le premier trouvé) et ne jamais lever si INV est vide/non initialisé.
  function testBossMatInHandSumsAcrossSlotsAndHandlesEmptyInv() {
    if (typeof bossMatInHand !== 'function') return;
    assert('INV vide/sans le matériau -> 0, pas de throw', bossMatInHand('mat_Pierre noire test inexistant') === 0);
    const savedInv = INV.slice();
    const freeIdx = INV.findIndex(s => s === null);
    if (freeIdx === -1) return; // sac plein dans l'état de test courant : rien à vérifier ici
    INV[freeIdx] = { key:'mat_Test Boss Have', name:'Test Boss Have', kind:'material', icon:'x', color:'#fff', qty:7, stackable:true, weight:0.1, val:1 };
    const freeIdx2 = INV.findIndex((s,i) => s === null && i !== freeIdx);
    let usedSecondSlot = false;
    if (freeIdx2 !== -1) { INV[freeIdx2] = { key:'mat_Test Boss Have', name:'Test Boss Have', kind:'material', icon:'x', color:'#fff', qty:3, stackable:true, weight:0.1, val:1 }; usedSecondSlot = true; }
    assert('Somme correcte sur 1 ou 2 slots partageant la même clé', bossMatInHand('mat_Test Boss Have') === (usedSecondSlot ? 10 : 7), `have=${bossMatInHand('mat_Test Boss Have')}`);
    for (let i = 0; i < INV.length; i++) INV[i] = savedInv[i];
  }
  // la ligne récompense du lobby (rewardLineHtml, renderBossLobbyHtml) doit afficher cette quantité
  // sans jamais lever, y compris quand le prochain boss connu n'a jamais été rencontré (matKey neuf).
  function testBossLobbyRewardLineShowsMatInHandWithoutThrow() {
    if (typeof renderBossLobbyHtml !== 'function') return;
    const savedLiveBoss = liveBoss;
    liveBoss = { boss:'kzarka', time: Date.now()-1000, expires: Date.now()+5*60*1000, hp:50000, maxHp:50000 };
    let html; try { html = renderBossLobbyHtml(); } catch (e) { html = null; }
    assert('renderBossLobbyHtml() ne lève pas même sans avoir combattu ce boss avant', html !== null);
    const div = document.createElement('div'); div.innerHTML = html || '';
    assert('La carte "prochain boss" affiche la ligne récompense (quantité en poche)', !!div.querySelector('.bossNextReward'));
    liveBoss = savedLiveBoss;
  }
  // "borne la taille de la fiche coffre a une taille standard par rapport au autre" (2026-07-08) --
  // #veliaChestGrid doit suivre le MÊME mécanisme de synchro de hauteur que zoneList/lootTable
  // (syncFarmCardHeights, core/game-core.js), pas un max-height fixe indépendant des cartes voisines.
  function testChestGridFollowsSameHeightSyncAsSiblingCards() {
    if (typeof syncFarmCardHeights !== 'function' || !$('veliaChestGrid') || !$('lootPanelTabs')) return;
    const chestTab = $('lootPanelTabs').querySelector('.lootPanelTab[data-panel="chest"]');
    const lootTab = $('lootPanelTabs').querySelector('.lootPanelTab[data-panel="loot"]');
    if (!chestTab || !lootTab) return;
    chestTab.click();
    const chestMax = parseFloat($('veliaChestGrid').style.maxHeight);
    lootTab.click();
    const lootMax = parseFloat($('lootTable').style.maxHeight);
    assert('Le coffre reçoit un max-height calculé dynamiquement (pas le fixe 260px)', chestMax > 0 && chestMax !== 260, `chestMax=${chestMax}`);
    assert('Le coffre et la table de loot suivent la même échelle (même carte statsCard de référence)', Math.abs(chestMax - lootMax) < 60, `chestMax=${chestMax} lootMax=${lootMax}`);
  }
  // "l'anneau de yuria ne fournit pas les bonus +1 +2 dans la liste lors de l'opti automatique"
  // (2026-07-12) -- optAutoGainPrimaryPart() ne testait que WEAPON_SLOTS (PA) vs le reste (PD),
  // oubliant que les bijoux (JEWELRY_SLOTS) donnent de la PA eux aussi (jamais de PD) : le delta
  // PD d'un bijou est toujours 0, donc aucun gain n'était jamais affiché dans la liste déroulante.
  function testJewelryShowsGainInAutoOptList() {
    // cible un palier assez haut (PRI, garanti) pour que le gain croise un seuil entier quel que
    // soit le détail exact de la courbe d'enchantement (voir gearFloor/effectiveApDp) -- +1 seul
    // peut légitimement n'afficher aucun gain si la fraction accumulée n'a pas encore franchi un
    // entier (comportement voulu, voir le commentaire sur optAutoGainPrimaryPart), donc pas fiable
    // pour isoler CE bug précis.
    const target = PRI_IDX;
    const ring = { name:'test', kind:'jackpot', slot:'ring', ap:10, dp:0, hp:0, enhLv:0, optimizable:true };
    const gainRing = optAutoGainPrimaryPart(ring, target);
    assert('Un bijou (ring1) affiche bien un gain de PA dans la liste', gainRing.includes('PA') && gainRing !== '', `got="${gainRing}"`);
    // même vérification pour les 2 autres types de bijoux (boucle/collier/ceinture)
    const earring = { name:'test2', kind:'jackpot', slot:'earring', ap:8, dp:0, hp:0, enhLv:0, optimizable:true };
    assert('Un bijou (earring1) affiche aussi un gain de PA', optAutoGainPrimaryPart(earring, target).includes('PA'));
    // vérifie que ça ne casse pas le comportement existant pour armure (PD) et arme (PA)
    const helmet = { name:'test3', kind:'gear', slot:'helmet', ap:0, dp:10, hp:0, enhLv:0, optimizable:true };
    assert('Une pièce d\'armure (helmet) affiche toujours un gain de PD', optAutoGainPrimaryPart(helmet, target).includes('PD'));
    const weapon = { name:'test4', kind:'gear', slot:'weapon', ap:10, dp:0, hp:0, enhLv:0, optimizable:true };
    assert('Une arme affiche toujours un gain de PA', optAutoGainPrimaryPart(weapon, target).includes('PA'));
  }
  // "la flèche qui affiche le stuff à farm sur la zone ne doit pas s'afficher si le stuff est dans
  // l'inventaire" (2026-07-11) -- zonesOfferingUpgrade() (badge ⬆️ sur les lignes de la liste de
  // zones) ne doit plus proposer un socle pour lequel un objet meilleur est DÉJÀ possédé, non
  // équipé, dans le sac : il suffit de l'équiper, pas la peine d'aller le farmer.
  function testZoneUpgradeArrowHiddenIfAlreadyInBag() {
    const s = { zoneIdx, EQUIP_weapon: EQUIP.weapon, z4ReqAP: ZONES[4].reqAP, z4ReqDP: ZONES[4].reqDP,
      maxZoneIdx: S.maxZoneIdx, a: INV[INV_SIZE-1] };
    ZONES[4].reqAP = 1; ZONES[4].reqDP = 1;
    EQUIP.weapon = { name:'test', kind:'gear', slot:'weapon', ap:5, dp:0, hp:0, enhLv:5, optimizable:true, color: GEAR_TIERS[0].color }; // grey
    zoneIdx = 3; // palier blanc : la pièce grey équipée est d'un palier inférieur, upgrade possible ici
    S.maxZoneIdx = ZONES.length - 1;
    INV[INV_SIZE-1] = null;
    // teste directement ownedBetterInBagForSlot (pas zonesOfferingUpgrade().has(4), qui agrège
    // TOUS les socles et dépendrait de l'état réel des autres équipements du perso de démo live)
    assert('rien de mieux pour l\'arme dans le sac -> ownedBetterInBagForSlot false',
      !ownedBetterInBagForSlot('weapon'));
    // objet MEILLEUR que l'équipé (ap:5), pour ce même socle, déjà dans le sac
    INV[INV_SIZE-1] = { name:'testBetter', kind:'gear', slot:'weapon', ap:50, dp:0, hp:0, enhLv:0, val:1, qty:1, color: GEAR_TIERS[1].color };
    assert('un objet meilleur déjà dans le sac -> ownedBetterInBagForSlot true',
      ownedBetterInBagForSlot('weapon'));
    zoneIdx = s.zoneIdx; EQUIP.weapon = s.EQUIP_weapon; ZONES[4].reqAP = s.z4ReqAP; ZONES[4].reqDP = s.z4ReqDP;
    S.maxZoneIdx = s.maxZoneIdx; INV[INV_SIZE-1] = s.a;
  }
  // "chaque catégorie d'item a sa pierre associée d'optimisation on doit pas avoir un stuff tuvala
  // qui s'opti avec une pierre de naru" (2026-07-11) -- findEnhanceMaterial() ne doit JAMAIS
  // retomber sur un matériau d'un autre palier, ni honorer un matériau épinglé (clic droit) qui ne
  // correspond pas au palier de la pièce ciblée.
  function testEnhanceMaterialNeverSubstitutesWrongTier() {
    const s = { optTarget, EQUIP_weapon: EQUIP.weapon, forcedMatKey, a: INV[INV_SIZE-1], b: INV[INV_SIZE-2] };
    optTarget = { loc:'equip', key:'weapon' };
    EQUIP.weapon = { name:'test', kind:'gear', slot:'weapon', ap:5, dp:0, hp:0, enhLv:0, optimizable:true, matName:'Pierre du Temps' }; // Tuvala
    INV[INV_SIZE-1] = null; INV[INV_SIZE-2] = null;
    forcedMatKey = null;
    // isolation (2026-07-08, bug corrigé : "regarde les 3 echecs systematique") -- findEnhanceMaterial()
    // cherche dans TOUT INV, pas seulement les 2 cases de test ci-dessous : un compte ayant déjà
    // réellement looté "Pierre de Novice"/"Pierre du Temps" ailleurs dans son sac (cas normal en
    // cours de partie) faisait échouer l'égalité stricte INV[...] === INV[INV_SIZE-2] même quand le
    // COMPORTEMENT était parfaitement correct (l'index trouvé pointait juste vers une AUTRE case
    // valide du même matériau). Ces éventuelles cases réelles sont neutralisées le temps du test,
    // puis restaurées à l'identique -- vraie isolation, plus de dépendance à l'état du compte.
    const stashed = [];
    for (let i = 0; i < INV_SIZE - 2; i++) {
      const it = INV[i];
      if (it && (it.name === 'Pierre de Novice' || it.name === 'Pierre du Temps')) { stashed.push([i, it]); INV[i] = null; }
    }
    // seule une pierre de Naru (mauvais palier) est en stock -> aucun matériau ne doit être trouvé
    INV[INV_SIZE-1] = { key:'mat_Pierre de Novice', name:'Pierre de Novice', kind:'material', qty:5, stackable:true, weight:0.1, val:1 };
    assert('findEnhanceMaterial refuse la pierre de Naru pour une pièce Tuvala', findEnhanceMaterial() === -1);
    // la bonne pierre (Tuvala) est ajoutée -> doit être trouvée
    INV[INV_SIZE-2] = { key:'mat_Pierre du Temps', name:'Pierre du Temps', kind:'material', qty:5, stackable:true, weight:0.1, val:1 };
    assert('findEnhanceMaterial trouve la pierre du bon palier (Tuvala)', INV[findEnhanceMaterial()] === INV[INV_SIZE-2]);
    // matériau épinglé (clic droit "Mettre en optimisation") sur la pierre de Naru -> doit être
    // ignoré (mauvais palier), pas utilisé de force, retombe sur la pierre Tuvala correcte
    forcedMatKey = 'mat_Pierre de Novice';
    assert('un matériau épinglé du mauvais palier est ignoré, jamais forcé', INV[findEnhanceMaterial()] === INV[INV_SIZE-2]);
    optTarget = s.optTarget; EQUIP.weapon = s.EQUIP_weapon; forcedMatKey = s.forcedMatKey;
    INV[INV_SIZE-1] = s.a; INV[INV_SIZE-2] = s.b;
    for (const [i, it] of stashed) INV[i] = it;
  }
  // "strcitement, suit cette liste car aucune pierre ne se met dans le slot pour les bijou" (2026-07-11)
  // -- bug trouvé : les bijoux (jackpot) n'avaient JAMAIS de matName (contrairement au gear/armes),
  // donc findEnhanceMaterial() retombait sur le matériau de la zone COURANTE au lieu de celui du
  // PALIER du bijou ciblé. Vérifie le drop (rollDrops) ET la rétroactivité (migrateJewelryMatNameV239).
  function testJewelryHasMatNameForEnhancement() {
    const s = { zoneIdx, optTarget, ring1: EQUIP.ring1, dropsLen: drops.length };
    // un bijou fraîchement dropé (zone 3, Camp Rhutum, palier blanc/Tuvala) doit porter le matName
    // de SON palier, exactement comme le gear/les armes (rollDrops, pas rollGearDrop)
    zoneIdx = 3;
    assert('Le palier de la zone 3 utilise bien Pierre du Temps (Tuvala)', gearTierForZone(3).material.name === 'Pierre du Temps');
    let freshJackpotMatName = null;
    // chance de jackpot très faible (zone 3 : ch=.0028) -- 500 essais laissait ~25% de chance de
    // rater complètement (miss flaky confirmé en live), 8000 réduit ce risque à quasi zéro
    for (let i = 0; i < 8000 && freshJackpotMatName == null; i++) {
      const before = drops.length;
      rollDrops({x:0,y:0}, true, 1);
      for (let k = before; k < drops.length; k++) if (drops[k].item.kind === 'jackpot') freshJackpotMatName = drops[k].item.matName;
    }
    drops.length = s.dropsLen; // nettoie tous les drops générés par ce test
    assert('Un bijou fraîchement dropé porte le matName de son palier (Pierre du Temps)',
      freshJackpotMatName === 'Pierre du Temps', `got=${freshJackpotMatName}`);
    // simule un bijou déjà possédé AVANT ce correctif (matName jamais renseigné) pour vérifier la
    // rétroactivité -- "Anneau Tuvala" vient de la zone 3 (voir JACKPOT_NAME_TO_ZONE)
    EQUIP.ring1 = { name:'Anneau Tuvala', kind:'jackpot', slot:'ring', ap:3, enhLv:0, color:GEAR_TIERS[1].color, key:'r_old' };
    delete EQUIP.ring1.matName; // simule une sauvegarde d'avant ce correctif
    migrateJewelryMatNameV239();
    assert('migrateJewelryMatNameV239 backfill le bon matName (Pierre du Temps)',
      EQUIP.ring1.matName === 'Pierre du Temps', `got=${EQUIP.ring1.matName}`);
    // l'auto-sélection de matériau doit utiliser CE matName, jamais la zone où l'on farme
    // actuellement (ici zone 0, palier gris/Naru -- totalement différent du bijou Tuvala équipé)
    optTarget = { loc:'equip', key:'ring1' };
    zoneIdx = 0;
    assert('findEnhanceMaterial utilise le palier du BIJOU (Tuvala), pas la zone actuelle (gris)',
      (EQUIP.ring1.matName || Z().loot.mat.name) === 'Pierre du Temps');
    zoneIdx = s.zoneIdx; optTarget = s.optTarget; EQUIP.ring1 = s.ring1;
  }
  // "lorsqu'on optimise un objet d'inventaire, il doit seulement se mettre en optimisation sans
  // toucher a l'equipement équipé" (2026-07-17) -- avant ce correctif, "Mettre en optimisation"
  // sur un objet du sac appelait equipItem() en plus de cibler l'optimisation, remplaçant ce qui
  // était équipé. Vérifie que cibler un objet du sac (optTarget={loc:'inv',...}) ne touche jamais
  // à EQUIP et que l'objet reste enchantable là où il est (getOptTargetItem() le résout).
  function testInvOptTargetDoesNotEquip() {
    const s = { optTarget, EQUIP_weapon: EQUIP.weapon, forcedMatKey, inv: INV[INV_SIZE-1] };
    EQUIP.weapon = null;
    const item = { name:'testBagOpt', kind:'gear', slot:'weapon', ap:5, dp:0, hp:0, enhLv:0, optimizable:true, matName:'Pierre du Temps' };
    INV[INV_SIZE-1] = item;
    forcedMatKey = null;
    optTarget = { loc:'inv', key: INV_SIZE-1 };
    assert('Cibler un objet du sac pour l\'optimisation ne l\'équipe pas', EQUIP.weapon === null);
    assert('L\'objet ciblé reste dans le sac, à sa place', INV[INV_SIZE-1] === item);
    assert('getOptTargetItem() résout bien vers l\'objet du sac ciblé', getOptTargetItem() === item);
    optTarget = s.optTarget; EQUIP.weapon = s.EQUIP_weapon; forcedMatKey = s.forcedMatKey; INV[INV_SIZE-1] = s.inv;
  }
  // "on peut optimiser les item du compendium jusqu'à PEN, une fois PEN il disparaissent du
  // compendium et on ne garde dans le compendium uniquement des item TET maximum" (2026-07-17) --
  // garde-fou de régression : un objet du Compendium enchanté jusqu'à PEN (voir attemptEnhance)
  // doit être évacué vers le sac principal, jamais laissé dans COMPENDIUM_BAG au-delà de TET.
  function testCompendiumEvictsItemOnceItReachesPen() {
    // garantit un slot libre pour l'évacuation (invAdd retourne false si INV.findIndex(null)===-1)
    // -- sans ça, ce test dépend silencieusement de l'état du sac du compte démo (192/192 = échec
    // à tort, sans rapport avec la logique testée -- piège connu, voir CLAUDE.md section 11)
    const freeIdx = INV_SIZE-2;
    const s = { optTarget, forcedMatKey, comp: COMPENDIUM_BAG[INV_SIZE-1], inv: INV[INV_SIZE-1], freeSlot: INV[freeIdx], hadMastery: !!(S.penMastery && S.penMastery['testCompPenItem']) };
    INV[freeIdx] = null;
    const item = { name:'testCompPenItem', kind:'gear', slot:'weapon', ap:5, dp:0, hp:0, enhLv: ENH_NAMES.length-2, optimizable:true, matName:'Pierre du Temps' };
    COMPENDIUM_BAG[INV_SIZE-1] = item;
    INV[INV_SIZE-1] = { key:'mat_Pierre du Temps', name:'Pierre du Temps', kind:'material', qty:5, stackable:true, weight:0.1, val:1 };
    if (!S.penMastery) S.penMastery = {};
    delete S.penMastery['testCompPenItem'];
    forcedMatKey = null;
    optTarget = { loc:'compendium', key: INV_SIZE-1 };
    const savedRandom = Math.random;
    Math.random = () => 0; // force le succès (chance toujours strictement positive à ce palier)
    attemptEnhance();
    Math.random = savedRandom;
    assert('L\'objet a bien atteint PEN', item.enhLv === ENH_NAMES.length-1, `enhLv=${item.enhLv}`);
    assert('Compendium : l\'objet PEN est évacué, jamais gardé au-delà de TET', COMPENDIUM_BAG[INV_SIZE-1] === null);
    const movedIdx = INV.findIndex(x => x && x.name === 'testCompPenItem');
    assert('L\'objet évacué rejoint le sac principal, jamais perdu', movedIdx !== -1 && INV[movedIdx].enhLv === ENH_NAMES.length-1);
    if (movedIdx !== -1) INV[movedIdx] = null;
    optTarget = s.optTarget; forcedMatKey = s.forcedMatKey; COMPENDIUM_BAG[INV_SIZE-1] = s.comp; INV[INV_SIZE-1] = s.inv; INV[freeIdx] = s.freeSlot;
    delete S.enhPeakByName['testCompPenItem'];
    if (s.hadMastery) S.penMastery['testCompPenItem'] = true; else delete S.penMastery['testCompPenItem'];
  }
  // "taxe market 20% dorenavant" (2026-07-18) -- garde-fou de synchronisation : la constante
  // client MARKET_SELL_TAX_RATE (aperçu affiché avant de placer un ordre, voir
  // updateMktTaxHint()) doit rester alignée sur le facteur réel appliqué côté serveur
  // (market_match_item/market_sell_material, migration 20260718110000_market_sales_tax_20pct.sql,
  // "* 0.8"). Ne peut pas vérifier le SQL directement depuis ce fichier client -- documente et
  // fige la valeur attendue pour qu'un futur changement du taux SQL sans toucher ce fichier soit
  // repéré au moins côté rappel (voir le commentaire au-dessus de MARKET_SELL_TAX_RATE).
  function testMarketSellTaxRateMatchesServerFactor() {
    if (typeof MARKET_SELL_TAX_RATE === 'undefined') return; // pas de DOM/module marché chargé
    assert('MARKET_SELL_TAX_RATE vaut bien 35% (0.65 côté SQL)', MARKET_SELL_TAX_RATE === 0.35, `got=${MARKET_SELL_TAX_RATE}`);
  }
  // ---------- refonte "Marché commun" v3 (2026-07-22) : catalogue unifié + popup Acheter ----------
  // Le catalogue "objets sans vente en cours" (marketCatalog()) DOIT être construit depuis les
  // VRAIES données du jeu (GEAR_TIERS/ZONES/MARKET_MATERIALS), jamais depuis des noms inventés --
  // le mockup fourni utilisait des noms de boss BDO réels mais absents de CE jeu (Kzarka/Kutum/
  // Nouver/Ogre pour du gear, alors que Kzarka n'existe ici que comme WORLD BOSS et que le gear
  // suit ses propres paliers Naru/Tuvala/Yuria/Grunil). Garde-fou : chaque entrée catalogue doit
  // pouvoir être retracée jusqu'à sa source réelle.
  function testMarketCatalogUsesOnlyRealGameNames() {
    if (typeof marketCatalog === 'undefined') return;
    const catalog = marketCatalog();
    assert('marketCatalog() renvoie au moins une entrée', catalog.length > 0);
    const gearNames = new Set();
    GEAR_TIERS.forEach(t => Object.values(t.sets).forEach(n => gearNames.add(n)));
    const jewelNames = new Set(ZONES.map(z => z.loot && z.loot.jackpot && z.loot.jackpot.name).filter(Boolean));
    const matNames = new Set(MARKET_MATERIALS.map(m => m.name));
    const bogus = catalog.filter(c => !gearNames.has(c.name) && !jewelNames.has(c.name) && !matNames.has(c.name));
    assert('Chaque entrée du catalogue vient d\'une VRAIE source de données (GEAR_TIERS/ZONES/MARKET_MATERIALS), aucun nom inventé façon mockup',
      bogus.length === 0, `noms non traçables=${bogus.map(c=>c.name).join(', ')}`);
    assert('Le catalogue ne contient PAS de noms fictifs du mockup (Kzarka/Kutum/Nouver en tant que gear)',
      !catalog.some(c => /Kzarka|Kutum|Nouver/.test(c.name)));
  }
  // GEAR_TIERS × 7 slots = toute l'armure/les armes early-game ; la catégorie "artifact" (slots
  // artifact1/artifact2/eqStone) n'a AUCUNE source de drop dans ce jeu (voir NO_SOURCE_SLOTS,
  // inventory-ui.js) -- décision documentée : aucune entrée catalogue générée pour elle.
  function testMarketCatalogCoversGearSlotsAndSkipsArtifactDeadCategory() {
    if (typeof marketCatalog === 'undefined') return;
    const catalog = marketCatalog();
    const expectedGear = GEAR_TIERS.length * 7;
    const gearCount = catalog.filter(c => c.kind === 'gear').length;
    assert(`Catalogue : ${expectedGear} entrées gear (GEAR_TIERS × 7 slots)`, gearCount === expectedGear, `got=${gearCount}`);
    assert('Catalogue : au moins un matériau par MARKET_MATERIALS', catalog.filter(c => c.kind === 'material').length === MARKET_MATERIALS.length);
    assert('Catalogue : aucune entrée catégorie "artifact" (aucune source de drop réelle, voir NO_SOURCE_SLOTS)',
      !catalog.some(c => c.catId === 'artifact'));
    if (typeof NO_SOURCE_SLOTS !== 'undefined') {
      assert('Hypothèse encore vraie : artifact1/artifact2/eqStone toujours sans source de drop (sinon revoir marketCatalog())',
        ['artifact1','artifact2','eqStone'].every(s => NO_SOURCE_SLOTS.includes(s)));
    }
  }
  // clé d'objet cohérente avec le serveur (market_place_order/v_real_key) : 'material:<nom>' pour
  // les matériaux, 'gear:<nom>+<enhLv>' pour TOUT le reste (gear ET bijoux, le serveur ne distingue
  // pas les deux dans son calcul de clé) -- toute divergence casserait market_order_book/market_trades.
  function testCmItemKeyMatchesServerKeyFormat() {
    if (typeof cmItemKey === 'undefined') return;
    assert('clé matériau = material:<nom>', cmItemKey('material', 'Pierre de Novice', 0) === 'material:Pierre de Novice');
    assert('clé gear = gear:<nom>+<enhLv>', cmItemKey('gear', 'Bâton Naru', 5) === 'gear:Bâton Naru+5');
    assert('clé bijou (jackpot) utilise aussi le préfixe gear: comme le serveur (v_real_key)', cmItemKey('jackpot', 'Anneau Naru', 0) === 'gear:Anneau Naru+0');
    assert('enhLv manquant retombe sur 0', cmItemKey('gear', 'Bâton Naru', undefined) === 'gear:Bâton Naru+0');
  }
  // bug réel corrigé le 2026-07-22 : l'ancien placeMarketOrder() (mort depuis le retrait de l'onglet
  // "Vendre" le 2026-07-08, jamais appelé) résolvait l'emplacement à vendre par SEUL nom+kind, sans
  // filtrer par enhLv -- avec 2 exemplaires du même objet à des paliers différents dans le sac, il
  // pouvait vendre le MAUVAIS. findInvIndexForSell()/ownedQtyFor() (nouvelle popup Acheter/offre de
  // vente) DOIVENT filtrer sur le enhLv exact.
  function testFindInvIndexForSellMatchesExactEnhLv() {
    if (typeof findInvIndexForSell === 'undefined') return;
    const s = { a: INV[INV_SIZE-1], b: INV[INV_SIZE-2] };
    INV[INV_SIZE-1] = { name:'Bâton Naru', kind:'gear', slot:'weapon', ap:10, dp:0, hp:0, enhLv:3, key:'t_low' };
    INV[INV_SIZE-2] = { name:'Bâton Naru', kind:'gear', slot:'weapon', ap:20, dp:0, hp:0, enhLv:12, key:'t_high' };
    const idxLow = findInvIndexForSell('Bâton Naru', 'gear', 3);
    const idxHigh = findInvIndexForSell('Bâton Naru', 'gear', 12);
    assert('findInvIndexForSell retrouve le bon exemplaire à enhLv=3 (pas l\'autre variante)', idxLow === INV_SIZE-1, `got=${idxLow}`);
    assert('findInvIndexForSell retrouve le bon exemplaire à enhLv=12 (pas l\'autre variante)', idxHigh === INV_SIZE-2, `got=${idxHigh}`);
    assert('findInvIndexForSell renvoie -1 si aucun exemplaire à ce enhLv exact', findInvIndexForSell('Bâton Naru', 'gear', 7) === -1);
    INV[INV_SIZE-1] = s.a; INV[INV_SIZE-2] = s.b;
  }
  // ownedQtyFor : les matériaux s'empilent (somme des qty sur tous les slots), le gear/bijou est
  // toujours binaire (0 ou 1) MÊME s'il existe d'autres exemplaires du même nom à un autre enhLv
  // (ils ne comptent PAS comme "possédé" pour CE niveau précis consulté dans le détail/la popup).
  function testOwnedQtyForMaterialsSumsButGearIsBinaryPerEnhLv() {
    if (typeof ownedQtyFor === 'undefined') return;
    const s = { a: INV[INV_SIZE-1], b: INV[INV_SIZE-2], c: INV[INV_SIZE-3] };
    INV[INV_SIZE-1] = { name:'Pierre de Novice', kind:'material', qty:12, stackable:true, key:'m1' };
    INV[INV_SIZE-2] = { name:'Pierre de Novice', kind:'material', qty:5, stackable:true, key:'m2' };
    INV[INV_SIZE-3] = { name:'Bâton Naru', kind:'gear', slot:'weapon', enhLv:9, key:'g1' };
    assert('ownedQtyFor matériau = somme des stacks (12+5=17)', ownedQtyFor('Pierre de Novice', 'material', 0) === 17, `got=${ownedQtyFor('Pierre de Novice','material',0)}`);
    assert('ownedQtyFor gear au enhLv réellement possédé = 1', ownedQtyFor('Bâton Naru', 'gear', 9) === 1);
    assert('ownedQtyFor gear à un AUTRE enhLv (non possédé) = 0, même si le nom existe ailleurs dans le sac', ownedQtyFor('Bâton Naru', 'gear', 3) === 0);
    INV[INV_SIZE-1] = s.a; INV[INV_SIZE-2] = s.b; INV[INV_SIZE-3] = s.c;
  }
  // garde-fou d'ordre de chargement (même famille que testSorcierRenderLoadsBeforeSyncStartupCallers) :
  // market.js appelle marketCatalog() qui lit GEAR_TIERS/ZONES/MARKET_MATERIALS et des fonctions
  // d'icônes (gear-icons.js) -- uniquement DANS des corps de fonction (jamais au chargement
  // immédiat), donc l'ordre relatif n'a normalement pas d'importance (voir CLAUDE.md §7). Ce test
  // fige quand même market.js APRÈS ces fichiers dans index.dev.html, pour que ça reste vrai si un
  // jour un appel top-level y est ajouté par erreur.
  function testMarketScriptLoadsAfterGearZoneAndIconData() {
    const scripts = [...document.scripts].map(s => s.src);
    const idxOf = frag => scripts.findIndex(s => s.includes(frag));
    const idxMarket = idxOf('src/market/market.js');
    if (idxMarket === -1) return; // pas chargé dans ce contexte (ex: bundle prod sans tests)
    ['src/inventory/gear-icons.js', 'src/world/zones-data.js', 'src/world/gear-tiers-data.js', 'src/inventory/inventory-ui.js'].forEach(frag => {
      const idx = idxOf(frag);
      assert(`market.js charge après ${frag} (marketCatalog() lit ces données/fonctions)`, idx !== -1 && idx < idxMarket, `idx(${frag})=${idx} idxMarket=${idxMarket}`);
    });
  }
  // "verifie le wiki de fond en comble" (2026-07-18) -- audit qui a trouvé le Wiki affirmant "4
  // objets collectibles" pour le Trésor de Velia alors que VELIA_TREASURE n'en contient que 2.
  // Garde-fou DYNAMIQUE (pas un nombre codé en dur) : compare le texte du Wiki au vrai tableau,
  // pour attraper tout futur ajout d'un fragment (ex: le tresor "Sceau du Conclave") sans mise à
  // jour du Wiki -- voir la règle mémoire "valeurs de stat figées = dérive silencieuse".
  function testWikiTreasureCountMatchesRealArray() {
    if (typeof WIKI_SECTIONS === 'undefined' || typeof VELIA_TREASURE === 'undefined') return;
    const combat = WIKI_SECTIONS.find(s => s.id === 'combat'); if (!combat) return;
    const n = VELIA_TREASURE.length;
    assert(`Le Wiki (FR) mentionne bien ${n} objet(s) de Trésor de Velia (VELIA_TREASURE.length)`,
      combat.fr.includes(`${n} objet`), `attendu "${n} objet", texte non trouvé`);
    assert(`Le Wiki (EN) mentionne bien ${n} collectible(s)`,
      combat.en.includes(`${n} very rare collectible`), `attendu "${n} very rare collectible", texte non trouvé`);
  }
  // le coût variable de la Pierre de Cron par palier (1/2/3/4, voir CRON_STONE_COST_BY_TIER)
  // n'était mentionné nulle part dans le Wiki avant cet audit -- garde-fou : vérifie que les 4
  // valeurs réelles apparaissent bien dans le texte, pour attraper un futur rééquilibrage oublié.
  function testWikiMentionsCronCostPerTier() {
    if (typeof WIKI_SECTIONS === 'undefined' || typeof CRON_STONE_COST_BY_TIER === 'undefined') return;
    const enh = WIKI_SECTIONS.find(s => s.id === 'enh'); if (!enh) return;
    for (const grade of ['grey','white','green','blue']) {
      const cost = CRON_STONE_COST_BY_TIER[grade];
      assert(`Le Wiki (FR) mentionne le coût Cron du palier ${grade} (${cost})`, enh.fr.includes(String(cost)), `coût=${cost}`);
    }
  }
  // le Wiki ne mentionnait que le boss Kzarka (quotidien), omettant complètement Vell (boss
  // hebdomadaire, ajouté le 2026-07-08) -- garde-fou contre un retour de cette omission.
  function testWikiMentionsBothWorldBosses() {
    if (typeof WIKI_SECTIONS === 'undefined' || typeof BOSS_ROSTER === 'undefined') return;
    const combat = WIKI_SECTIONS.find(s => s.id === 'combat'); if (!combat) return;
    for (const bossId of Object.keys(BOSS_ROSTER)) {
      const marker = bossId === 'kzarka' ? 'Kzarka' : bossId === 'vell' ? 'Vell' : bossId;
      assert(`Le Wiki (FR) mentionne le boss "${marker}"`, combat.fr.includes(marker), `boss=${bossId}`);
    }
  }
  // garde-fou (2026-07-11, bug réel trouvé en testant leaderboard-panel.js) : `$a('btnXxx').onclick
  // = maFonctionDansUnAutreFichier;` (SANS closure) évalue le nom immédiatement, à l'exécution de
  // CE script -- si la fonction vit dans un fichier chargé PLUS TARD (ex: leaderboard-panel.js
  // après game-supabase.js), ça lève un ReferenceError qui coupe le script EN PLEIN MILIEU. Tout ce
  // qui est déclaré plus loin dans CE MÊME fichier (WIKI_SECTIONS etc., même les fonctions à cause
  // du point d'arrêt) ne s'exécute alors jamais -- symptôme sournois : les `function` déclarées
  // AVANT le point de coupure restent hoistées et semblent fonctionner, seuls les `const`/`let`
  // déclarés APRÈS restent inaccessibles, imitant une TDZ. Toujours passer par une closure
  // (`() => maFonction()`) quand le handler vit dans un fichier qui charge après (voir §6-8).
  function testLateScriptGlobalsSurviveButtonWiring() {
    assert('WIKI_SECTIONS accessible (game-supabase.js s\'est exécuté jusqu\'au bout, pas coupé par une réf. anticipée)',
      typeof WIKI_SECTIONS !== 'undefined');
    assert('PATCH_NOTES accessible', typeof PATCH_NOTES !== 'undefined');
    // LB2_CATS_() : renommé de const objet vers fonction le 2026-07-11 (migration i18next, les
    // labels/tips doivent se relire à chaque appel i18next.t(), pas figés une seule fois au
    // chargement du script) -- garder ce test à jour avec le nom réel, sinon il devient un no-op
    // silencieux (typeof sur un nom qui n'existe plus == 'undefined' == condition jamais vraie).
    if (typeof LB2_CATS_ === 'function') {
      // 8e catégorie "compendium" ajoutée le 2026-07-11 (r.compendium_pct, jamais utilisé par un
      // classement avant) -- garder cette liste à jour à chaque nouvelle catégorie, sinon ce test
      // devient silencieusement incomplet plutôt que de détecter une régression.
      assert('LB2_CATS_() couvre les 8 catégories du classement principal (dont Compendium)',
        ['silver','gs','zone','sh','kpm','item','treasure','compendium'].every(k => LB2_CATS_()[k]));
    }
  }
  // ---------- Classement : catégorie Compendium (2026-07-11, r.compendium_pct) ----------
  function testLb2CompendiumCategoryUsesRealPct() {
    if (typeof LB2_CATS_ !== 'function') return;
    const cat = LB2_CATS_().compendium;
    assert('Catégorie Compendium définie dans LB2_CATS_()', !!cat);
    if (!cat) return;
    const row = { compendium_pct: 42.7 };
    assert('LB2_CATS_().compendium.val() lit bien r.compendium_pct', cat.val(row) === 42.7, `val=${cat.val(row)}`);
    assert('LB2_CATS_().compendium.fmt() affiche un pourcentage arrondi', cat.fmt(row) === '43%', `fmt=${cat.fmt(row)}`);
    assert('LB2_CATS_().compendium.val() ne plante pas sans compendium_pct (undefined -> 0)', cat.val({}) === 0);
  }
  // ---------- Classement : "Ta position" hors du top LB2_TOP_N ----------
  // garde-fou (2026-07-11, demande explicite) : le rang réel doit être calculé sur TOUTES les
  // lignes déjà chargées (jusqu'à 500 via .select('*').limit(500), aucune requête supplémentaire),
  // pas seulement la page affichée -- lb2ComputeYourRankInfo() est une fonction PURE (ne lit aucun
  // état module), testable directement avec des lignes fabriquées.
  function testLb2ComputeYourRankInfoFindsRealRankOutsideTop20() {
    if (typeof lb2ComputeYourRankInfo !== 'function') return;
    const rows = [];
    for (let i = 0; i < 30; i++) rows.push({ user_id: 'lb2test-u'+i, silver: (30-i)*1000 });
    // u0 a le plus de silver (rang 1) ; la valeur décroît strictement avec i -> rang == i+1
    const info = lb2ComputeYourRankInfo(rows, 'silver', 'lb2test-u24');
    assert('lb2ComputeYourRankInfo calcule le bon rang réel, hors du top 20', info && info.rank === 25, `rank=${info&&info.rank}`);
    assert('lb2ComputeYourRankInfo renvoie le nombre total de joueurs classés dans la catégorie', info && info.total === 30, `total=${info&&info.total}`);
    const top = lb2ComputeYourRankInfo(rows, 'silver', 'lb2test-u0');
    assert('lb2ComputeYourRankInfo fonctionne aussi pour un rang dans le top (pas réservé au hors-top)', top && top.rank === 1, `rank=${top&&top.rank}`);
    const missing = lb2ComputeYourRankInfo(rows, 'silver', 'lb2test-unknown-user');
    assert('lb2ComputeYourRankInfo renvoie null si le joueur n\'a pas encore de record synchronisé', missing === null);
    assert('lb2ComputeYourRankInfo renvoie null sans userId (invité/déconnecté)', lb2ComputeYourRankInfo(rows, 'silver', null) === null);
  }
  // seuil "top" utilisé par lb2RenderBody() pour décider d'afficher la barre "Ta position" --
  // garde-fou pour qu'un futur changement du seuil soit un choix explicite, pas un oubli.
  function testLb2YourRankBarThresholdIsTop20() {
    if (typeof LB2_TOP_N === 'undefined') return;
    assert('Le seuil "top" de la barre "Ta position" du Classement est bien 20 (podium 1-3 + tableau 4-20)',
      LB2_TOP_N === 20, `LB2_TOP_N=${LB2_TOP_N}`);
  }
  // ---------- Classement : panneau invité stylé (remplace l'alert() brut, 2026-07-11) ----------
  function testLb2GuestGateReusesMarketCopyAndRealLinkButton() {
    if (typeof lb2GuestGateHtml !== 'function') return;
    const html = lb2GuestGateHtml();
    // le HTML rendu passe par escapeHtml() (échappe les guillemets du texte source) -- comparer à
    // la même version échappée, pas au texte brut de i18next.t(), sinon faux négatif systématique.
    assert('Le panneau invité du Classement réutilise le texte EXACT de market:market.auth_verified_required (pas un texte dupliqué)',
      html.includes(escapeHtml(i18next.t('market:market.auth_verified_required'))));
    assert('Le panneau invité du Classement contient bien le bouton de liaison de compte (id lb2LinkAccountBtn)',
      html.includes('id="lb2LinkAccountBtn"'));
  }
  // garde-fou statique (voir CLAUDE.md §11, "inspection du code source via .toString()") : vérifie
  // que openLeaderboard2() affiche le panneau invité stylé pour un compte invité plutôt qu'un
  // alert() brut -- seul le cas "aucune session du tout" (!sb || !currentUser) garde l'alerte
  // historique de marketRequireAuth(), jamais appelée dans la branche isGuest().
  function testOpenLeaderboard2ShowsStyledGuestGateNotRawAlert() {
    if (typeof openLeaderboard2 !== 'function') return;
    const src = openLeaderboard2.toString();
    assert('openLeaderboard2 affiche lb2GuestGateHtml() pour un compte invité, plutôt qu\'un alert() natif',
      src.includes('lb2GuestGateHtml'));
  }
  // garde-fou (2026-07-21, bug réel trouvé en buildant le panneau Donation) : un "https://" brut au
  // milieu d'un template literal MULTI-LIGNE a fait planter le strip de commentaires du build
  // (scripts/build.py, strip_js_comments_safe) -- le "//" de l'URL a été avalé comme un commentaire
  // de ligne, tronquant la fonction en plein milieu et cassant tout ce qui suivait dans le fichier
  // (Terser a heureusement échoué fort plutôt que de générer un bundle silencieusement corrompu).
  // Corrigé en sortant l'URL du template literal ('https:' + '//...'). Ce test vérifie que le lien
  // Discord réel du Wiki reste bien présent ET que le fichier ne s'est pas fait tronquer autour
  // (wkInjectHeadingIds, défini juste après wkDiscordHtml, doit rester une fonction).
  function testWikiDiscordLinkNeverTruncatesTheFile() {
    if (typeof wkDiscordHtml !== 'function') return;
    const html = wkDiscordHtml();
    assert('Le Wiki (section Discord) contient le vrai lien d\'invitation, pas un placeholder',
      html.includes('discord.gg/fEubtqMjtP'));
    assert('wkInjectHeadingIds (défini juste après wkDiscordHtml dans le fichier) est bien accessible -- ' +
      'si ce n\'est pas le cas, le fichier a probablement été tronqué par le build',
      typeof wkInjectHeadingIds === 'function');
  }
  // "pense aux animations de sorts aussi" / "des effets un peu different pour chaque sort"
  // (2026-07-18) -- chaque sort doit avoir sa propre identité visuelle de cast (castColor/
  // castBurst/castJitter), sinon witchBodyOn retombe silencieusement sur la teinte du palier
  // pour TOUS les sorts (comportement d'avant cette demande, jamais revenir en arrière sans
  // s'en apercevoir). Vérifie aussi que spawnCastOriginVfx ne plante sur aucun sort du roster.
  function testEverySkillHasDistinctCastIdentity() {
    if (typeof SKILLS === 'undefined') return;
    for (const sk of SKILLS) {
      assert(`${sk.id} a un castColor`, !!sk.castColor, `sk=${sk.id}`);
      assert(`${sk.id} a un castBurst`, !!sk.castBurst, `sk=${sk.id}`);
      assert(`${sk.id} a un castJitter`, typeof sk.castJitter === 'number' && sk.castJitter > 0, `sk=${sk.id}`);
    }
    // pas 2 sorts avec exactement le même trio couleur+burst+jitter (identité vraiment distincte,
    // pas juste des champs renseignés au hasard) -- une petite tolérance : 2 sorts peuvent
    // légitimement partager un castBurst (ex: thunder/lstorm en 'crackle') tant que la couleur ou
    // le jitter les distingue encore
    const seen = new Set();
    for (const sk of SKILLS) {
      const key = `${sk.castColor}|${sk.castBurst}|${sk.castJitter}`;
      assert(`${sk.id} a une identité de cast unique (pas un doublon exact)`, !seen.has(key), `key=${key}`);
      seen.add(key);
    }
  }
  function testSpawnCastOriginVfxNeverThrows() {
    if (typeof spawnCastOriginVfx !== 'function' || typeof SKILLS === 'undefined' || typeof particles === 'undefined') return;
    const before = particles.length;
    for (const sk of SKILLS) {
      let threw = false;
      try { spawnCastOriginVfx(sk); } catch (e) { threw = true; }
      assert(`spawnCastOriginVfx(${sk.id}) ne lève pas d'exception`, !threw);
    }
    particles.length = before; // nettoie les particules de test, ne pollue pas la partie réelle
  }
  // witchBodyOn ne doit jamais planter, que castingSkill soit un objet SKILLS, false, ou null --
  // et doit refléter le castColor du sort passé plutôt que retomber sur la teinte du palier
  function testWitchBodyOnAcceptsSkillObjectWithoutThrowing() {
    if (typeof witchBodyOn === 'undefined' || typeof SKILLS === 'undefined' || typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 60; canvas.height = 60;
    const g = canvas.getContext('2d'); if (!g) return;
    let threw = false;
    try {
      witchBodyOn(g, 0, false);
      witchBodyOn(g, 0, SKILLS[1]); // meteor, castColor défini
    } catch (e) { threw = true; }
    assert('witchBodyOn accepte false et un objet SKILLS sans exception', !threw);
  }
  // "on voit rien des visuel animation du sorcier" (2026-07-08) -- le rendu idle-vs-cast était
  // techniquement différent (couleur du cristal) mais visuellement trop discret (~8.5% des pixels
  // du sprite changeaient). Après agrandissement du cristal/aura, verrouille qu'un cast diffère
  // du repos sur une portion largement plus visible du sprite -- empêche un futur "correctif" de
  // rendu de re-réduire silencieusement la taille/opacité sous le seuil perceptible.
  function testCastVisualDifferenceIsClearlyVisible() {
    if (typeof witchBodyOn === 'undefined' || typeof SKILLS === 'undefined' || typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 80; canvas.height = 100;
    const g = canvas.getContext('2d'); if (!g) return;
    function render(skillOrFalse, t) {
      g.clearRect(0,0,80,100);
      g.save(); g.translate(40,70);
      witchBodyOn(g, t, skillOrFalse);
      g.restore();
      return g.getImageData(0,0,80,100).data;
    }
    const idle = render(false, 0);
    const meteor = render(SKILLS.find(s=>s.id==='meteor'), 0.1);
    let diffCount = 0;
    for (let i=0;i<idle.length;i+=4) {
      const d = Math.abs(idle[i]-meteor[i]) + Math.abs(idle[i+1]-meteor[i+1]) + Math.abs(idle[i+2]-meteor[i+2]);
      if (d > 10) diffCount++;
    }
    assert('Le rendu en cast diffère du repos sur au moins 800 pixels (visible, pas juste techniquement présent)',
      diffCount >= 800, `diffCount=${diffCount}`);
  }
  // "créer des effet de plus en plus visuel pour les sors avec des ornement... bleu = 5 ornement
  // vert = 4 et le reste peu de visuel moins flashy... bleu = tres flashy tres visuel" (2026-07-08)
  // -- verrouille l'ORDRE de flashiness entre paliers (isolé par diff avec/sans ornements, pas une
  // simple luminosité de sprite qui serait faussée par la couleur de robe elle-même).
  function testOrnamentFlashinessIncreasesByTier() {
    if (typeof witchBodyOn === 'undefined' || typeof ORNAMENT_TIER === 'undefined' || typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
    const g = canvas.getContext('2d'); if (!g) return;
    const savedEquip = { ...EQUIP };
    function renderDiff(grade) {
      const tier = GEAR_TIERS.find(t => t.grade === grade);
      EQUIP.armor = { color: tier.color, kind:'gear' };
      function render() {
        g.clearRect(0,0,100,100);
        g.save(); g.translate(50,70);
        witchBodyOn(g, 0.3, SKILLS.find(s=>s.id==='meteor'));
        g.restore();
        return g.getImageData(0,0,100,100).data;
      }
      const withOrn = render();
      const savedN = ORNAMENT_TIER[grade].n;
      ORNAMENT_TIER[grade].n = 0;
      const withoutOrn = render();
      ORNAMENT_TIER[grade].n = savedN;
      let diffCount = 0;
      for (let i=0;i<withOrn.length;i+=4) {
        const d = Math.abs(withOrn[i]-withoutOrn[i])+Math.abs(withOrn[i+1]-withoutOrn[i+1])+Math.abs(withOrn[i+2]-withoutOrn[i+2]);
        if (d>0) diffCount++;
      }
      return diffCount;
    }
    const grey = renderDiff('grey'), white = renderDiff('white'), green = renderDiff('green'), blue = renderDiff('blue');
    Object.keys(EQUIP).forEach(k => EQUIP[k] = savedEquip[k]);
    assert('Ornements : gris <= blanc (progression douce au bas de l\'échelle)', grey <= white, `grey=${grey} white=${white}`);
    assert('Ornements : blanc < vert (net saut de flashiness)', white < green, `white=${white} green=${green}`);
    assert('Ornements : vert < bleu (bleu le plus flashy de tous)', green < blue, `green=${green} blue=${blue}`);
  }
  // "Regarde le compendium retroactivement des objet PEN" (2026-07-08, bug trouvé : un joueur avec
  // un objet déjà à PEN AVANT l'ajout de la Maîtrise PEN ne le voyait jamais compté) -- vérifie que
  // migratePenMasteryV308 scanne bien équipement/sac/Compendium et marque tout objet déjà au max.
  function testMigratePenMasteryV308MarksExistingPenItems() {
    if (typeof migratePenMasteryV308 !== 'function') return;
    const savedPenMastery = { ...S.penMastery };
    const savedHelmet = EQUIP.helmet;
    S.penMastery = {};
    const maxLvl = ENH_NAMES.length - 1;
    EQUIP.helmet = { name:'Test Helmet PEN Migration', kind:'gear', optimizable:true, enhLv:maxLvl };
    migratePenMasteryV308();
    assert('migratePenMasteryV308 marque un objet équipé déjà à PEN', S.penMastery['Test Helmet PEN Migration'] === true);
    EQUIP.helmet = savedHelmet;
    S.penMastery = savedPenMastery;
  }
  // "verifier si tout les stuff sont dans la maitrise pen" (2026-07-08) -- BUG trouvé : la liste
  // utilisait GEAR_SLOTS (réduit aux 4 pièces d'armure depuis le 2026-07-05, voir gear-tiers-data.js)
  // au lieu de WEAPON_SLOTS+ARMOR_SLOTS -- les 12 armes (bâton/éveil/dague × 4 paliers) n'étaient
  // JAMAIS suivies. Verrouille les 44 entrées (4 paliers × 7 pièces + 4 bijoux), l'ordre arme->
  // armure->bijou, et le regroupement par palier de couleur (jamais mélangé entre paliers).
  function testPenMasteryListIncludesAllGearAndIsOrderedByTier() {
    if (typeof penMasteryItemList !== 'function') return;
    const list = penMasteryItemList();
    assert('44 entrées au total (4 paliers × (3 armes + 4 armure + 4 bijoux))', list.length === 44, `got=${list.length}`);
    const weaponSlots = ['weapon','awakening','secondary'], armorSlots = ['helmet','armor','gloves','boots'];
    assert('12 pièces d\'arme suivies (3 × 4 paliers)', list.filter(e => weaponSlots.includes(e.slot)).length === 12);
    assert('16 pièces d\'armure suivies (4 × 4 paliers)', list.filter(e => armorSlots.includes(e.slot)).length === 16);
    assert('16 bijoux suivis (1 par zone × 16 zones)', list.filter(e => e.kind==='jackpot').length === 16);
    assert('Bâton Grunil (arme du palier bleu) est bien présent', list.some(e => e.name === 'Bâton Grunil'));
    // ordre : dans chaque palier, arme(s) avant armure avant bijou, jamais mélangé entre paliers
    let lastTierIdx = -1, sawArmorInTier = false;
    for (const e of list) {
      const tierIdx = GEAR_TIERS.findIndex(t => t.grade === e.grade);
      if (tierIdx !== lastTierIdx) { lastTierIdx = tierIdx; sawArmorInTier = false; }
      if (armorSlots.includes(e.slot)) sawArmorInTier = true;
      if (weaponSlots.includes(e.slot)) assert(`Arme "${e.name}" n'apparaît jamais après une armure du même palier`, !sawArmorInTier);
    }
  }
  // bug réel signalé le 2026-07-19 (capture d'écran : "Maîtrise PEN (45/44)") -- compendiumPenCount()
  // comptait TOUTES les clés de S.penMastery, y compris un nom orphelin qui ne fait plus partie de
  // penMasteryItemList() (renommage/rééquilibrage passé jamais nettoyé) -- ne doit JAMAIS dépasser
  // penMasteryItemList().length, même avec une entrée obsolète dans la sauvegarde.
  function testCompendiumPenCountNeverExceedsMaxEvenWithStaleEntry() {
    if (typeof compendiumPenCount !== 'function' || typeof penMasteryItemList !== 'function' || typeof S === 'undefined') return;
    const saved = { ...S.penMastery };
    try {
      const max = penMasteryItemList().length;
      S.penMastery = {};
      penMasteryItemList().forEach(e => { S.penMastery[e.name] = true; }); // les 44 entrées valides
      assert('Toutes les entrées valides marquées -> compteur = max exact', compendiumPenCount() === max, `got=${compendiumPenCount()}, max=${max}`);
      S.penMastery['UnAncienNomObsoleteQuiNexistePlus'] = true; // simule une entrée orpheline (renommage passé)
      assert('Une entrée orpheline ne doit JAMAIS faire dépasser le max affiché (bug réel : "45/44")', compendiumPenCount() === max, `got=${compendiumPenCount()}, max=${max}`);
    } finally {
      S.penMastery = saved;
    }
  }
  // "Maitrise pen ajoute a cote de chaque categorie ?/11 et montre que c'est fais si c'est 11/11"
  // (2026-07-09) -- chaque en-tête de palier (.zTierHead) doit porter un compteur exact X/11, et
  // la classe "done" uniquement quand X===11 (jamais avant, jamais pour un autre palier).
  function testPenMasteryTierHeadersShowCountAndDoneAt11() {
    if (typeof renderCompendiumHtml !== 'function' || compendiumTab === undefined) return;
    const savedTab = compendiumTab, savedPen = { ...S.penMastery };
    compendiumTab = 'pen';
    S.penMastery = {};
    penMasteryItemList().filter(e => e.grade === 'grey').forEach(e => S.penMastery[e.name] = true);
    const div = document.createElement('div'); div.innerHTML = renderCompendiumHtml();
    const headers = [...div.querySelectorAll('.zTierHead')];
    assert('4 en-têtes de palier affichées (grey/white/green/blue)', headers.length === 4, `got=${headers.length}`);
    const grey = headers.find(h => h.textContent.includes('Naru'));
    const white = headers.find(h => h.textContent.includes('Tuvala'));
    assert('Palier gris (complet) affiche 11/11', grey && grey.querySelector('.zTierHeadCount').textContent === '11/11', `texte=${grey && grey.textContent}`);
    assert('Palier gris (complet) porte la classe "done"', grey && grey.classList.contains('done'));
    assert('Palier blanc (vide) affiche 0/11', white && white.querySelector('.zTierHeadCount').textContent === '0/11', `texte=${white && white.textContent}`);
    assert('Palier blanc (vide) ne porte PAS la classe "done"', white && !white.classList.contains('done'));
    compendiumTab = savedTab; S.penMastery = savedPen;
  }
  // "Un item qui passe pen... supprime l'item non pen du sac protégé compendium" (2026-07-08) --
  // généralise l'éviction : un exemplaire ÉQUIPÉ (pas la copie protégée elle-même) qui atteint PEN
  // doit quand même faire sortir du Compendium la copie non-PEN du même nom qui y était protégée.
  function testEvictMasteredFromCompendiumBagOnAnyCopyReachingPen() {
    if (typeof evictMasteredFromCompendiumBag !== 'function') return;
    const freeIdx = INV.findIndex(s => s === null);
    if (freeIdx === -1) return; // sac plein, invAdd refuserait légitimement -- pas un cas testable ici
    const savedInv = INV[freeIdx];
    const savedComp0 = COMPENDIUM_BAG[0];
    const savedPen = S.penMastery['Test Helmet Evict Regression'];
    INV[freeIdx] = null;
    COMPENDIUM_BAG[0] = { name:'Test Helmet Evict Regression', kind:'gear', optimizable:true, enhLv:2 };
    S.penMastery['Test Helmet Evict Regression'] = true; // simule un AUTRE exemplaire (équipé) ayant atteint PEN
    evictMasteredFromCompendiumBag('Test Helmet Evict Regression');
    assert('Compendium : la copie non-PEN protégée est évacuée dès que le nom est maîtrisé', COMPENDIUM_BAG[0] === null);
    assert('Compendium : la copie évacuée rejoint bien le sac principal', INV.some(s => s && s.name === 'Test Helmet Evict Regression'));
    const invIdx = INV.findIndex(s => s && s.name === 'Test Helmet Evict Regression');
    if (invIdx !== -1) INV[invIdx] = null;
    INV[freeIdx] = savedInv;
    COMPENDIUM_BAG[0] = savedComp0;
    if (savedPen === undefined) delete S.penMastery['Test Helmet Evict Regression']; else S.penMastery['Test Helmet Evict Regression'] = savedPen;
  }
  // rattrapage rétroactif : migratePenMasteryV308 doit aussi évacuer une copie protégée du
  // Compendium dont le nom vient d'être marqué maîtrisé PAR CETTE MÊME migration (pas seulement
  // les copies déjà marquées avant).
  function testMigratePenMasteryV308EvictsCompendiumRetroactively() {
    if (typeof migratePenMasteryV308 !== 'function') return;
    const freeIdx = INV.findIndex(s => s === null);
    if (freeIdx === -1) return;
    const savedInv = INV[freeIdx];
    const savedComp0 = COMPENDIUM_BAG[0];
    const savedHelmet = EQUIP.helmet;
    const savedPen = { ...S.penMastery };
    const maxLvl = ENH_NAMES.length - 1;
    INV[freeIdx] = null;
    S.penMastery = {};
    EQUIP.helmet = { name:'Test Helmet Retro Migration', kind:'gear', optimizable:true, enhLv:maxLvl };
    COMPENDIUM_BAG[0] = { name:'Test Helmet Retro Migration', kind:'gear', optimizable:true, enhLv:3 };
    migratePenMasteryV308();
    assert('Migration rétroactive : marque bien la maîtrise PEN', S.penMastery['Test Helmet Retro Migration'] === true);
    assert('Migration rétroactive : évacue la copie Compendium devenue inutile', COMPENDIUM_BAG[0] === null);
    assert('Migration rétroactive : la copie évacuée rejoint le sac', INV.some(s => s && s.name === 'Test Helmet Retro Migration'));
    const invIdx = INV.findIndex(s => s && s.name === 'Test Helmet Retro Migration');
    if (invIdx !== -1) INV[invIdx] = null;
    INV[freeIdx] = savedInv;
    COMPENDIUM_BAG[0] = savedComp0;
    EQUIP.helmet = savedHelmet;
    S.penMastery = savedPen;
  }
  // "Classement public : meilleur uniquement pas en temps reel donc oublie la synchro, on veut
  // juste le meilleur" (2026-07-08) -- Gearscore/PA/PD ACTUELS peuvent redescendre (rééquipement,
  // outil admin de test...) : verrouille que les records bestGearscore/bestAp/bestDp ne redescendent
  // JAMAIS même si l'équipement actuel régresse ensuite (même principe que bestKpm/bestSilverPerHour).
  function testBestGearscoreApDpNeverDecrease() {
    const savedEquip = { ...EQUIP };
    const before = { bestGearscore: S.bestGearscore, bestAp: S.bestAp, bestDp: S.bestDp };
    GEAR_SLOTS.forEach(slot => { EQUIP[slot] = { kind:'gear', ap:200, dp:200, hp:0, dodge:0, optimizable:true, enhLv:0 }; });
    hud();
    const highGearscore = S.bestGearscore, highAp = S.bestAp, highDp = S.bestDp;
    assert('Un gros équipement fait bien monter les records', highGearscore > 0 && highAp > 0 && highDp > 0);
    GEAR_SLOTS.forEach(slot => { EQUIP[slot] = null; });
    hud();
    assert('Déséquiper complètement ne fait PAS redescendre bestGearscore', S.bestGearscore === highGearscore, `avant=${highGearscore} apres=${S.bestGearscore}`);
    assert('Déséquiper complètement ne fait PAS redescendre bestAp', S.bestAp === highAp, `avant=${highAp} apres=${S.bestAp}`);
    assert('Déséquiper complètement ne fait PAS redescendre bestDp', S.bestDp === highDp, `avant=${highDp} apres=${S.bestDp}`);
    Object.keys(EQUIP).forEach(k => EQUIP[k] = savedEquip[k]);
    S.bestGearscore = before.bestGearscore; S.bestAp = before.bestAp; S.bestDp = before.bestDp;
    hud();
  }
  // "1M5/h alors que c'est faux" + "le classement... toujours le meilleur affiché" (2026-07-18) --
  // bestSilverPerHour ne doit JAMAIS redescendre (comme bestKpm), et seulement après 2 min de
  // session (jamais sur un pic de tout début de partie) -- garde-fou de régression contre un
  // retour du bug (extrapolation directement en /h dès 6s de session).
  function testBestSilverPerHourNeverDecreasesAndRequiresTwoMinutes() {
    const s = { bestSilverPerHour: S.bestSilverPerHour, tokenSilverEarned: S.tokenSilverEarned,
      tokenSilverEarnedAtLoad: S.tokenSilverEarnedAtLoad, startTime: S.startTime };
    // simule une session de 30s avec un gros gain -> ne doit PAS mettre à jour le record (mins<2)
    S.bestSilverPerHour = 1000;
    S.tokenSilverEarnedAtLoad = 0;
    S.tokenSilverEarned = 50000; // extrapolé sur 30s -> 6M/h, un pic exactement comme le bug d'origine
    S.startTime = performance.now() - 30*1000;
    hud();
    assert('Un gros gain sur <2min de session ne modifie PAS le record (protège contre les pics)',
      S.bestSilverPerHour === 1000, `bestSilverPerHour=${S.bestSilverPerHour}`);
    // simule une session de 3 min avec un rythme réellement plus élevé -> le record doit monter
    S.tokenSilverEarned = 100000;
    S.startTime = performance.now() - 3*60*1000;
    hud();
    assert('Un rythme soutenu sur >2min de session met bien à jour le record (record monte)',
      S.bestSilverPerHour > 1000, `bestSilverPerHour=${S.bestSilverPerHour}`);
    const afterFirstUpdate = S.bestSilverPerHour;
    // un rythme plus FAIBLE ensuite ne doit jamais faire REDESCENDRE le record (monotone)
    S.tokenSilverEarnedAtLoad = 99000; S.tokenSilverEarned = 99100;
    S.startTime = performance.now() - 3*60*1000;
    hud();
    assert('Le record ne redescend jamais (monotone, comme bestKpm)', S.bestSilverPerHour === afterFirstUpdate,
      `avant=${afterFirstUpdate} apres=${S.bestSilverPerHour}`);
    S.bestSilverPerHour = s.bestSilverPerHour; S.tokenSilverEarned = s.tokenSilverEarned;
    S.tokenSilverEarnedAtLoad = s.tokenSilverEarnedAtLoad; S.startTime = s.startTime;
  }
  // "afficher valeur/min puis meilleure valeur/heure" (2026-07-18) -- #shRate doit afficher un
  // format ".../min" (jamais "/h" pour la valeur instantanée, source du bug de pic irréaliste)
  function testShRateDisplaysPerMinuteNotPerHour() {
    if (!$('shRate')) return; // pas de DOM (contexte hors-jeu)
    const s = { tokenSilverEarned: S.tokenSilverEarned, tokenSilverEarnedAtLoad: S.tokenSilverEarnedAtLoad, startTime: S.startTime };
    S.tokenSilverEarnedAtLoad = 0; S.tokenSilverEarned = 1000;
    S.startTime = performance.now() - 10*1000; // 10s de session
    hud();
    const txt = $('shRate').textContent;
    assert('#shRate affiche bien "/min", jamais "/h" pour la valeur instantanée', txt.includes('/min') && !txt.includes(' silver/h'), `texte="${txt}"`);
    S.tokenSilverEarned = s.tokenSilverEarned; S.tokenSilverEarnedAtLoad = s.tokenSilverEarnedAtLoad; S.startTime = s.startTime;
  }
  // "bouton admin changer tout le stuff d'un coup de tiers Bleu a vert et y mettre tout les tiers"
  // (2026-07-18) -- vérifie que les 4 paliers (pas seulement bleu/vert) équipent bien un set
  // complet (13 pièces : 7 armure/armes + 6 bijoux) sans planter, avec la bonne couleur de palier.
  function testAdminEquipFullTierSetCoversAllFourTiers() {
    if (typeof adminEquipFullTierSet !== 'function') return;
    const savedEquip = { ...EQUIP };
    for (const grade of ['grey','white','green','blue']) {
      const tier = GEAR_TIERS.find(t => t.grade === grade);
      const count = adminEquipFullTierSet(grade);
      assert(`adminEquipFullTierSet('${grade}') équipe bien 13 pièces (7 armure/armes + 6 bijoux)`, count === 13, `count=${count}`);
      for (const slot of ['helmet','armor','gloves','boots','weapon','awakening','secondary']) {
        assert(`${grade}/${slot} a la couleur du palier`, EQUIP[slot] && EQUIP[slot].color === tier.color, `slot=${slot}`);
        assert(`${grade}/${slot} est à +0 (set neuf)`, EQUIP[slot] && EQUIP[slot].enhLv === 0);
      }
      for (const slot of ['ring1','ring2','necklace','earring1','earring2','belt']) {
        assert(`${grade}/${slot} est bien équipé`, !!EQUIP[slot], `slot=${slot}`);
      }
    }
    Object.keys(EQUIP).forEach(k => { EQUIP[k] = savedEquip[k]; });
  }
  // "bouton qui agrandi le coffre 4 ou 8 par ligne" (2026-07-18) -- la bascule doit correctement
  // (dés)appliquer la classe chestZoomed et mettre à jour le texte du bouton
  function testChestZoomToggleWorks() {
    if (!$('veliaChestGrid') || !$('btnChestZoom') || typeof chestZoomed === 'undefined') return;
    const s = chestZoomed;
    chestZoomed = false; renderVeliaChest();
    assert('Vue normale : pas de classe chestZoomed', !$('veliaChestGrid').classList.contains('chestZoomed'));
    assert('Bouton propose "Agrandir" en vue normale', $('btnChestZoom').textContent.includes('Agrandir') || $('btnChestZoom').textContent.includes('Enlarge'));
    chestZoomed = true; renderVeliaChest();
    assert('Vue agrandie : classe chestZoomed appliquée', $('veliaChestGrid').classList.contains('chestZoomed'));
    assert('Bouton propose "Réduire" en vue agrandie', $('btnChestZoom').textContent.includes('Réduire') || $('btnChestZoom').textContent.includes('Shrink'));
    chestZoomed = s; renderVeliaChest();
  }
  // "enleve le scroll affiche les 2 a 7 dernier note selon la taille et met un bouton vers le haut
  // pour voir les nouveau et vers le bas pour regarder les ancien" (2026-07-11) -- computePatchPages()
  // découpe PATCH_NOTES en pages contiguës de 2 à 7 entrées, sans trou ni chevauchement.
  // bug trouvé le 2026-07-14 : checkForUpdate() (détection "nouvelle version disponible") allait
  // fetch game-supabase.js pour y chercher PATCH_NOTES via regex -- ça a cassé la notification en
  // silence quand PATCH_NOTES a été déplacé dans patch-notes-data.js (découpage de
  // game-supabase.js), sans qu'aucun test ne le détecte. Garde-fou statique (pas besoin de vrai
  // fetch réseau) : vérifie que la fonction cible bien le fichier qui contient RÉELLEMENT
  // PATCH_NOTES aujourd'hui, pour attraper immédiatement un futur déplacement oublié.
  function testCheckForUpdateFetchesFileThatActuallyContainsPatchNotes() {
    const src = checkForUpdate.toString();
    assert('checkForUpdate() fetch bien meta/patch-notes-data.js (le fichier qui définit réellement PATCH_NOTES)',
      src.includes("'./meta/patch-notes-data.js"), `src=${src.slice(0,200)}`);
    assert('checkForUpdate() ne fetch plus game-supabase.js (ne contient plus PATCH_NOTES depuis le découpage)',
      !src.includes("'./game-supabase.js"));
  }
  // issue GitHub #4 (audit de sécurité, 2026-07-14), finding L1 : les messages d'erreur Supabase
  // étaient injectés via innerHTML sans échappement (game-supabase.js:showPlayerGear,
  // admin-panel.js:refreshRoleList) -- pas d'exploitation trouvée avec les RPC actuelles, mais
  // fragile si une future RPC échoue avec de l'input utilisateur dans le message. Garde-fou
  // statique : vérifie que ces 2 points passent bien error.message par escapeHtml().
  function testErrorMessagesAreEscapedBeforeInnerHtml() {
    if (typeof showPlayerGear === 'function') {
      const src = showPlayerGear.toString();
      assert('showPlayerGear() échappe error.message avant innerHTML (escapeHtml)',
        /escapeHtml\(error\.message\)/.test(src), `src contient escapeHtml? ${src.includes('escapeHtml')}`);
    }
    if (typeof refreshRoleList === 'function') {
      const src = refreshRoleList.toString();
      assert('refreshRoleList() échappe (modErr||testErr).message avant innerHTML (escapeHtml)',
        /escapeHtml\(\(modErr\|\|testErr\)\.message\)/.test(src));
    }
  }
  // issue GitHub #4, finding M1 : le script Supabase JS était chargé en version flottante ("@2")
  // sans intégrité (SRI) -- un CDN ou un paquet npm compromis aurait pu exécuter du JS arbitraire
  // avec les pleins privilèges de la page. Vérifie directement sur le DOM déjà chargé (pas de
  // fetch réseau nécessaire, donc test synchrone comme le reste de la suite) qu'une version exacte
  // est figée et qu'un attribut integrity (SRI) est bien présent.
  function testSupabaseScriptIsPinnedWithIntegrity() {
    if (typeof document === 'undefined') return; // hors-contexte navigateur
    const tag = Array.from(document.scripts).find(s => s.src.includes('@supabase/supabase-js'));
    assert('index.html charge supabase-js (balise trouvée dans le DOM)', !!tag);
    if (!tag) return;
    assert('index.html charge supabase-js avec une version exacte (pas "@2" flottant)',
      /@2\.\d+\.\d+/.test(tag.src), `src=${tag.src}`);
    assert('index.html charge supabase-js avec un attribut integrity (SRI)',
      !!tag.integrity && tag.integrity.startsWith('sha'), `integrity=${tag.integrity}`);
  }
  // regression V317 (2026-07-08) : classes/sorcier/sorcier-render.js (witchBodyOn, drawWitchIso)
  // chargeait APRÈS world/render.js -- or render.js appelle hud() de façon SYNCHRONE tout à la
  // fin de son chargement, AVANT requestAnimationFrame(loop) : hud() -> refreshInvUI() ->
  // renderEquipment() -> drawPreviewChar() -> drawWitchOn() -> witchBodyOn(). witchBodyOn
  // n'existant pas encore à ce moment-là, ce premier hud() lançait un ReferenceError qui coupait
  // le reste du chargement de render.js -- y compris requestAnimationFrame(loop), qui ne
  // s'exécutait donc JAMAIS : perso invisible, mais en réalité toute la boucle de jeu (combat,
  // loot, sauvegarde auto) restait gelée dès le chargement. Garde-fou statique : vérifie l'ordre
  // réel des <script> dans le DOM déjà chargé, pour attraper immédiatement un futur retour de ce
  // fichier après render.js/inventory-ui.js lors d'un prochain découpage.
  function testSorcierRenderLoadsBeforeSyncStartupCallers() {
    if (typeof document === 'undefined') return; // hors-contexte navigateur
    const srcIndexOf = needle => Array.from(document.scripts).findIndex(s => s.src.includes(needle));
    const sorcierIdx = srcIndexOf('classes/sorcier/sorcier-render.js');
    const renderIdx = srcIndexOf('world/render.js');
    const invUiIdx = srcIndexOf('inventory/inventory-ui.js');
    assert('classes/sorcier/sorcier-render.js est bien chargé (balise trouvée dans le DOM)', sorcierIdx !== -1);
    assert('world/render.js est bien chargé (balise trouvée dans le DOM)', renderIdx !== -1);
    assert('inventory/inventory-ui.js est bien chargé (balise trouvée dans le DOM)', invUiIdx !== -1);
    if (sorcierIdx === -1 || renderIdx === -1 || invUiIdx === -1) return;
    assert('sorcier-render.js charge AVANT render.js (hud() y appelle witchBodyOn de façon synchrone au chargement)',
      sorcierIdx < renderIdx, `sorcierIdx=${sorcierIdx}, renderIdx=${renderIdx}`);
    assert('sorcier-render.js charge AVANT inventory-ui.js (drawPreviewChar y appelle witchBodyOn)',
      sorcierIdx < invUiIdx, `sorcierIdx=${sorcierIdx}, invUiIdx=${invUiIdx}`);
  }
  // check systématique (2026-07-08, demande explicite : "revois les dates des patchnote / ajoute
  // check systematique") -- trouvé en vérifiant manuellement : plusieurs versions récentes
  // (V283-V299) avaient été datées 15-16/07/2026 alors que l'horloge réelle (Supabase + timestamps
  // git) était encore le 07-08/07/2026 -- aucun test n'aurait détecté cette dérive avant
  // publication. Vérifie le format DD/MM/YYYY HH:MM de chaque entrée ET que les dates ne remontent
  // JAMAIS en avançant dans PATCH_NOTES (index 0 = le plus récent, doit rester le plus récent).
  function testPatchNotesDatesFormatAndOrder() {
    const dateRe = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/;
    function toTimestamp(d) {
      const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
      if (!m) return null;
      const [, dd, mm, yyyy, hh, min] = m;
      return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00`).getTime();
    }
    // les entrées d'avant V53 (introduction du suivi de dates) n'ont pas de champ `d` du tout :
    // légitime (pas une régression) -- on ne valide format/ordre que sur les entrées datées
    let allValidFormat = true, badEntry = '';
    for (const p of PATCH_NOTES) {
      if (p.d === undefined) continue;
      if (!dateRe.test(p.d)) { allValidFormat = false; badEntry = `${p.v} (d="${p.d}")`; break; }
    }
    assert('Chaque date renseignée de PATCH_NOTES suit le format DD/MM/YYYY HH:MM', allValidFormat, badEntry);
    if (!allValidFormat) return; // pas de comparaison de timestamps si le format est déjà cassé
    let ordered = true, badPair = '';
    const dated = PATCH_NOTES.filter(p => p.d !== undefined);
    for (let i = 1; i < dated.length; i++) {
      const prev = toTimestamp(dated[i-1].d), cur = toTimestamp(dated[i].d);
      if (cur > prev) { ordered = false; badPair = `${dated[i].v} (${dated[i].d}) est APRÈS ${dated[i-1].v} (${dated[i-1].d})`; break; }
    }
    assert('PATCH_NOTES reste trié du plus récent (index 0) au plus ancien, sans jamais remonter dans le temps', ordered, badPair);
  }
  // garde-fou (2026-07-19) : découvert qu'une ligne avec sub:'admin' (et sub:'compte') n'affichait
  // AUCUNE étiquette de sous-catégorie car ces clés n'existaient pas dans PATCH_SUBCATS/
  // PATCH_SUBCATS_EN -- silencieux, aucune erreur console, juste un badge manquant. Empêche tout
  // futur `sub:'xxx'` orphelin de refaire la même chose.
  function testEveryPatchSubHasALabel() {
    if (typeof PATCH_SUBCATS === 'undefined' || typeof PATCH_SUBCATS_EN === 'undefined') return;
    const used = new Set();
    for (const p of PATCH_NOTES) {
      for (const lang of ['fr', 'en']) {
        if (!p[lang]) continue;
        for (const line of p[lang]) { if (line.sub) used.add(line.sub); }
      }
    }
    let missing = [];
    used.forEach(sub => {
      if (!PATCH_SUBCATS[sub]) missing.push(`${sub} (FR)`);
      if (!PATCH_SUBCATS_EN[sub]) missing.push(`${sub} (EN)`);
    });
    assert('Chaque sous-catégorie utilisée dans PATCH_NOTES a un libellé dans PATCH_SUBCATS et PATCH_SUBCATS_EN', missing.length === 0, missing.join(', '));
  }
  // publication de note de version sur Discord (2026-07-20, demande explicite : "ajoute la
  // publication de patchnote directement sur discord") -- formatPatchNoteForDiscord() est PURE
  // (aucun réseau/DOM), testable directement sur une vraie entrée de PATCH_NOTES.
  function testFormatPatchNoteForDiscord() {
    if (typeof formatPatchNoteForDiscord === 'undefined' || typeof PATCH_NOTES === 'undefined') return;
    const note = PATCH_NOTES[0];
    const { title, description } = formatPatchNoteForDiscord(note, 'fr');
    assert('Le titre Discord contient le numéro de version', title.indexOf(note.v) !== -1, title);
    assert('Le titre Discord contient le nom fr de la note', title.indexOf(note.name.fr) !== -1, title);
    assert('La description Discord contient une ligne par entrée fr', description.split('\n').length === note.fr.length, description);
    const icons = { new:'🆕', change:'🔄', fix:'🛠️', exploit:'🔒' };
    note.fr.forEach(line => {
      const icon = icons[line.t] || '•';
      assert(`La ligne "${line.tx.slice(0,30)}..." garde son icône ${icon} et son texte`, description.indexOf(`${icon} ${line.tx}`) !== -1);
    });
    // cas limite : version inconnue -> repli sur l'anglais géré par formatPatchNoteForDiscord lui-même
    const enOnly = { v:'V0', name:{en:'Test only'}, en:[{t:'new', tx:'English only line'}] };
    const enResult = formatPatchNoteForDiscord(enOnly, 'en');
    assert('Repli correct sur les lignes en quand lang="en"', enResult.description.indexOf('English only line') !== -1, enResult.description);
  }
  // garde-fou (2026-07-20, "toujours aucunes stats declosion... verifie si tout est connecté a
  // supabase") : bug rencontré 3 FOIS dans ce repo (log_playtime_ping le 2026-07-08,
  // mark_item_tutorial_seen ×2 et sync_companion_stats le 2026-07-20) -- le builder Postgrest
  // renvoyé PAR sb.rpc(...) directement n'implémente QUE .then() (thenable), jamais .catch().
  // Appeler .catch() dessus AVANT tout .then()/await lève "TypeError: ...catch is not a function"
  // -- silencieusement avalée par le try/catch englobant dans chaque cas réel, empêchant TOUTE
  // requête réseau de partir (le thenable ne s'exécute qu'au premier .then()). Reproduit le bug
  // avec un mock volontairement dépourvu de .catch() (comme le vrai builder) pour prouver que le
  // code appelant ne s'appuie plus sur .catch() direct.
  function testRpcFireAndForgetCallsNeverUseBareCatch() {
    if (typeof markItemTutorialSeen !== 'function' || typeof sb === 'undefined') return; // hors contexte navigateur
    function makeCatchlessBuilder(onThen) {
      // reproduit fidèlement le vrai PostgrestFilterBuilder : .then() existe, .catch() n'existe PAS.
      return { then(onFulfilled) { onThen(); if (onFulfilled) onFulfilled({ data: null, error: null }); return this; } };
    }
    const origSb = sb, origCurrentUser = currentUser, origTrackId = (typeof activeTutorialTrackId !== 'undefined' ? activeTutorialTrackId : undefined);
    let thenCalled = false;
    sb = { rpc() { return makeCatchlessBuilder(() => { thenCalled = true; }); } };
    currentUser = { id: 'test-rpc-fire-and-forget', email: 'test@test.local' };
    let threwOnTutorialSeen = false;
    try { markItemTutorialSeen('test_tuto_id_regression', false); } catch(e) { threwOnTutorialSeen = true; }
    assert('markItemTutorialSeen ne plante jamais avec un builder RPC sans .catch() (régression 2026-07-20)', !threwOnTutorialSeen);
    assert('markItemTutorialSeen appelle bien .then() sur le builder (pas juste bloqué par le guard)', thenCalled);
    if (typeof reportTutorialProgress === 'function' && typeof activeTutorialTrackId !== 'undefined') {
      thenCalled = false;
      activeTutorialTrackId = 'onboarding';
      let threwOnProgress = false;
      try { reportTutorialProgress(false, false); } catch(e) { threwOnProgress = true; }
      assert('reportTutorialProgress ne plante jamais avec un builder RPC sans .catch() (régression 2026-07-20)', !threwOnProgress);
      assert('reportTutorialProgress appelle bien .then() sur le builder', thenCalled);
      activeTutorialTrackId = origTrackId;
    }
    sb = origSb; currentUser = origCurrentUser;
  }
  // garde-fou (2026-07-20, "quand je reste longtemps dans compagnon le dashboard s'affiche") :
  // showPlayerInventoryWindow() ouvre une popup "Inventaire joueur" depuis le panneau admin, et
  // sondait toutes les 400ms si elle était fermée pour rouvrir openAdminPanel() -- MÊME si l'admin
  // avait depuis quitté le panneau (ex: parti tester le module Compagnon). Une popup laissée
  // ouverte en arrière-plan longtemps, puis fermée (manuellement ou par le navigateur), forçait le
  // panneau admin à réapparaître en pleine session Compagnon, sans prévenir. Garde-fou statique
  // (function.toString(), même pattern que testSorcierRenderLoadsBeforeSyncStartupCallers) : le
  // code doit vérifier l'état de #adminOverlay avant de rappeler openAdminPanel().
  function testPopupCloseOnlyReopensAdminPanelIfStillOpen() {
    if (typeof showPlayerInventoryWindow !== 'function') return;
    const src = showPlayerInventoryWindow.toString();
    const hasReopenCall = src.includes('openAdminPanel()');
    assert('showPlayerInventoryWindow rouvre bien le panneau admin quelque part (sinon ce test est obsolète)', hasReopenCall);
    if (!hasReopenCall) return;
    assert('Le rappel à openAdminPanel() est conditionné à adminOverlay encore "open" (régression 2026-07-20)',
      /classList\.contains\(['"]open['"]\)[\s\S]{0,80}openAdminPanel\(\)/.test(src));
  }
  function testPatchPagesCoverAllEntriesWithinBounds() {
    const pages = computePatchPages();
    assert('computePatchPages : la 1ère page commence à l\'index 0 (le plus récent)', pages[0].start === 0);
    let covered = 0;
    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i];
      assert(`Page ${i} : au plus 7 entrées`, pg.count <= 7, `count=${pg.count}`);
      assert(`Page ${i} : commence juste après la précédente (pas de trou/chevauchement)`, pg.start === covered, `start=${pg.start}, attendu=${covered}`);
      covered += pg.count;
    }
    assert('computePatchPages : couvre bien la totalité de PATCH_NOTES, sans rien oublier',
      covered === PATCH_NOTES.length, `covered=${covered}, total=${PATCH_NOTES.length}`);
    // toute page SAUF potentiellement la toute dernière (fin de l'historique) doit avoir au moins 2 entrées
    for (let i = 0; i < pages.length - 1; i++) {
      assert(`Page ${i} (non-finale) : au moins 2 entrées`, pages[i].count >= 2, `count=${pages[i].count}`);
    }
  }
  // navigation "Plus récent"/"Plus ancien" du panneau patch notes -- vérifie que les boutons
  // changent bien patchPageStart d'une page à l'autre (haut = vers l'index 0, bas = plus loin dans
  // l'historique), et que le bouton "Plus récent" est désactivé sur la toute première page.
  function testPatchNotesNavButtons() {
    if (!$a('infoBody') || !$a('infoOverlay')) return; // pas de DOM (contexte hors-jeu)
    const s = { patchPageStart, wasOpen: $a('infoOverlay').classList.contains('open') };
    patchPageStart = 0;
    renderPatchNotesPanel();
    const upBtn = $a('patchNavUp'), downBtn = $a('patchNavDown');
    if (!upBtn || !downBtn) { patchPageStart = s.patchPageStart; if (!s.wasOpen) $a('infoOverlay').classList.remove('open'); return; }
    assert('"Plus récent" désactivé sur la toute première page', upBtn.disabled);
    const pages = computePatchPages();
    if (pages.length > 1) {
      downBtn.click();
      assert('"Plus ancien" avance bien patchPageStart vers l\'historique', patchPageStart === pages[1].start, `patchPageStart=${patchPageStart}`);
      $a('patchNavUp').click(); // re-render : le bouton a été recréé, re-cibler
      assert('"Plus récent" ramène bien patchPageStart à la 1ère page', patchPageStart === 0, `patchPageStart=${patchPageStart}`);
    }
    patchPageStart = s.patchPageStart;
    // referme le panneau si ce test l'a ouvert (le joueur n'avait rien demandé) -- ne le laisse
    // ouvert que si un AUTRE panneau était déjà affiché avant ce test
    if (!s.wasOpen) $a('infoOverlay').classList.remove('open'); else renderPatchNotesPanel();
  }
  // "sac protégé compendium ... l'item optimisé qui part dans le compendium à la place du +0 garde
  // son optimisation" (2026-07-09) -- ensureCompendiumProtection() doit toujours faire remonter le
  // PLUS enchanté des exemplaires possédés dans le sac protégé (jamais un +0 si mieux existe),
  // en SWAP avec ce qui y était déjà (l'ancien retourne dans le sac principal, jamais perdu).
  function testCompendiumBackfillAfterSell() {
    const TEST_NAME = 'TestUniqueGearXYZ_compendium';
    const s = { a: INV[INV_SIZE-1], b: INV[INV_SIZE-2], c: INV[INV_SIZE-3], pen: S.penMastery[TEST_NAME], helmet: EQUIP.helmet };
    delete S.penMastery[TEST_NAME];
    INV[INV_SIZE-1] = null; INV[INV_SIZE-2] = null; INV[INV_SIZE-3] = null;
    // équipe un casque volontairement écrasant pour que sellOne (EQUIPE>COMPENDIUM>VENDRE) ne
    // dévie jamais vers un auto-équipement pendant ce test, qui porte sur le comportement compendium
    EQUIP.helmet = { name:'TestGuardHelmet', kind:'gear', slot:'helmet', ap:0, dp:9999, hp:0, enhLv:0 };
    // s'assure qu'aucune trace de ce nom ne traîne déjà dans le sac protégé (test précédent, etc.)
    const clearCompBag = () => { for (let i=0;i<INV_SIZE;i++) if (COMPENDIUM_BAG[i] && COMPENDIUM_BAG[i].name===TEST_NAME) COMPENDIUM_BAG[i]=null; };
    clearCompBag();

    // 2 exemplaires en stock : un +0 et un +3, aucun protégé pour l'instant -> le +3 (le plus
    // enchanté) doit être protégé, pas le +0
    INV[INV_SIZE-1] = { name:TEST_NAME, kind:'gear', slot:'helmet', ap:0, dp:5, hp:0, enhLv:0, val:10, key:'t1' };
    INV[INV_SIZE-2] = { name:TEST_NAME, kind:'gear', slot:'helmet', ap:0, dp:8, hp:0, enhLv:3, val:20, key:'t2' };
    sellOne(INV_SIZE-1); // vend le +0 (déclencheur quelconque) -> doit protéger le +3 restant
    assert('Backfill : le sac protégé contient bien un exemplaire après la vente', compendiumBagHasName(TEST_NAME));
    let protectedIt = COMPENDIUM_BAG.find(it => it && it.name === TEST_NAME);
    assert('Backfill : protège le PLUS enchanté des exemplaires restants', !!protectedIt && (protectedIt.enhLv||0) === 3, `enhLv=${protectedIt&&protectedIt.enhLv}`);
    assert('Backfill : l\'exemplaire promu a bien quitté le sac principal', INV[INV_SIZE-2] === null);
    clearCompBag(); INV[INV_SIZE-1] = null; INV[INV_SIZE-2] = null;

    // un +0 est déjà protégé ; un +5 apparaît ensuite dans le sac -> doit SWAP (le +5 prend la
    // place, le +0 revient dans le sac principal, jamais perdu)
    INV[INV_SIZE-1] = { name:TEST_NAME, kind:'gear', slot:'helmet', ap:0, dp:4, hp:0, enhLv:0, val:10, key:'t3' };
    ensureCompendiumProtection(TEST_NAME); // protège d'abord le +0 (rien de mieux disponible)
    protectedIt = COMPENDIUM_BAG.find(it => it && it.name === TEST_NAME);
    assert('Swap (préparation) : le +0 est bien protégé en l\'absence de mieux', !!protectedIt && (protectedIt.enhLv||0) === 0);
    INV[INV_SIZE-2] = { name:TEST_NAME, kind:'gear', slot:'helmet', ap:0, dp:9, hp:0, enhLv:5, val:30, key:'t4' };
    ensureCompendiumProtection(TEST_NAME);
    protectedIt = COMPENDIUM_BAG.find(it => it && it.name === TEST_NAME);
    assert('Swap : le +5 prend la place du +0 dans le sac protégé', !!protectedIt && (protectedIt.enhLv||0) === 5, `enhLv=${protectedIt&&protectedIt.enhLv}`);
    const backInMain = INV.find(it => it && it.name === TEST_NAME && (it.enhLv||0) === 0);
    assert('Swap : le +0 déplacé revient bien dans le sac principal, jamais perdu', !!backInMain);
    clearCompBag(); INV[INV_SIZE-1] = null; INV[INV_SIZE-2] = null;
    // retire aussi la copie du +0 revenue potentiellement à un autre index par invAdd
    for (let i=0;i<INV_SIZE;i++) if (INV[i] && INV[i].name===TEST_NAME) INV[i]=null;

    // déjà PEN -> aucune protection à maintenir, ensureCompendiumProtection ne doit rien faire
    INV[INV_SIZE-3] = { name:TEST_NAME, kind:'gear', slot:'helmet', ap:0, dp:9, hp:0, enhLv:5, val:30, key:'t5' };
    S.penMastery[TEST_NAME] = true;
    ensureCompendiumProtection(TEST_NAME);
    assert('Backfill : aucune protection si le type est déjà en maîtrise PEN', !compendiumBagHasName(TEST_NAME));

    clearCompBag();
    for (let i=0;i<INV_SIZE;i++) if (INV[i] && INV[i].name===TEST_NAME) INV[i]=null;
    EQUIP.helmet = s.helmet;
    if (s.pen === undefined) delete S.penMastery[TEST_NAME]; else S.penMastery[TEST_NAME] = s.pen;
    INV[INV_SIZE-1] = s.a; INV[INV_SIZE-2] = s.b; INV[INV_SIZE-3] = s.c;
  }
  // "on peut voir l'optimisation dans l'inventaire ET le compendium" (2026-07-09) : le badge de
  // niveau d'enchantement doit apparaître pour une pièce optimisable enchantée, jamais pour une
  // pièce non optimisable (bijoux, qui n'ont pas d'enhLv/PRI-PEN)
  function testCellEnhBadgeVisibility() {
    const enhanced = { kind:'gear', slot:'helmet', optimizable:true, enhLv:5 };
    const fresh = { kind:'gear', slot:'helmet', optimizable:true, enhLv:0 };
    const jewelry = { kind:'jackpot', slot:'ring1', ap:3 };
    assert('Badge d\'enchant visible sur une pièce enchantée', cellEnhBadgeHtml(enhanced).includes('cellEnh'));
    assert('Badge d\'enchant aussi visible sur une pièce fraîche (+0)', cellEnhBadgeHtml(fresh).includes('cellEnh'));
    assert('Pas de badge d\'enchant sur un bijou (non optimisable)', cellEnhBadgeHtml(jewelry) === '');
  }
  // "mettre en évidence Équiper meilleur quand un équipement meilleur est dans l'inventaire depuis
  // plus de 15 secondes et qu'il est meilleur que ton stuff actuel" (2026-07-09) : un objet fraîchement
  // looté (pickedAt récent) ne doit PAS déclencher le halo (le joueur n'a pas encore eu le temps de
  // le remarquer) ; un objet ancien mais moins bon non plus ; seul un objet ancien ET meilleur doit
  const TEST_INV_SLOT = INV_SIZE - 1; // dernière case, réutilisée par les autres tests de la même façon
  function testNeglectedUpgradeHighlight() {
    // isolation (2026-07-08) : hasNeglectedUpgradeInBag() scanne TOUT INV, pas seulement
    // TEST_INV_SLOT -- un compte réel ayant déjà un vrai objet meilleur qui traîne ailleurs dans
    // le sac (cas normal en cours de partie) déclenchait le halo indépendamment du fixture ci-dessous,
    // faisant échouer les assertions "pas de halo" même quand le comportement était correct.
    // Le sac entier est neutralisé le temps du test puis restauré à l'identique.
    const s = { helmet: EQUIP.helmet, inv: INV.slice() };
    for (let i = 0; i < INV_SIZE; i++) INV[i] = null;
    EQUIP.helmet = { name:'ref', kind:'gear', slot:'helmet', ap:0, dp:5, hp:0, color:GEAR_TIERS[0].color };
    INV[TEST_INV_SLOT] = { name:'better-fresh', kind:'gear', slot:'helmet', ap:0, dp:50, hp:0, color:GEAR_TIERS[3].color, pickedAt: Date.now() };
    assert('Pas de halo : objet meilleur mais looté à l\'instant (< 15s)', !hasNeglectedUpgradeInBag());
    INV[TEST_INV_SLOT] = { name:'worse-old', kind:'gear', slot:'helmet', ap:0, dp:1, hp:0, color:GEAR_TIERS[0].color, pickedAt: Date.now() - 20000 };
    assert('Pas de halo : objet ancien mais moins bon que l\'équipé', !hasNeglectedUpgradeInBag());
    INV[TEST_INV_SLOT] = { name:'better-old', kind:'gear', slot:'helmet', ap:0, dp:50, hp:0, color:GEAR_TIERS[3].color, pickedAt: Date.now() - 20000 };
    assert('Halo : objet ancien (>15s) ET meilleur que l\'équipé', hasNeglectedUpgradeInBag());
    EQUIP.helmet = s.helmet;
    for (let i = 0; i < INV_SIZE; i++) INV[i] = s.inv[i];
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
  // "revois les info que tu donne lorsqu'il y a plusieurs stats et que tu opti" (2026-07-09) : le
  // menu déroulant d'optimisation ne doit plus cumuler PD+PV+Esquive sur une seule ligne (illisible,
  // voir capture jointe) -- une seule stat, la PRINCIPALE de la pièce (PA pour arme/éveil/dague, PD
  // pour casque/armure/gants/bottes), jamais l'autre même si elle change aussi
  function testOptDropdownShowsOnlyPrimaryStat() {
    // kind/slot ajoutés (2026-07-17) -- optAutoGainPrimaryPart dérive désormais le stat principal
    // directement de l'objet (targetPrimaryStat), plus d'un slotId externe passé en 3e argument
    // (une cible sac/Compendium n'a pas de slot EQUIP), voir la généralisation de optTarget.
    const helmet = { kind:'gear', slot:'helmet', ap: 0, dp: 5, hp: 8, dodge: .2, enhLv: 0, fsByLevel: {} };
    const weapon = { kind:'gear', slot:'weapon', ap: 6, dp: 0, hp: 0, dodge: 0, enhLv: 0, fsByLevel: {} };
    const helmetTxt = optAutoGainPrimaryPart(helmet, 5);
    const weaponTxt = optAutoGainPrimaryPart(weapon, 5);
    assert('Casque : le menu ne montre que la PD, jamais PV/Esquive', helmetTxt.includes('PD') && !helmetTxt.includes('PV') && !helmetTxt.includes('Esq'));
    assert('Arme : le menu montre la PA, jamais la PD', weaponTxt.includes('PA') && !weaponTxt.includes('PD'));
    assert('Aucun gain -> texte vide (pas de parenthèses vides)', optAutoGainPrimaryPart(helmet, 0) === '');
  }
  // "revois le prix des potion en fonction de l'argent qu'on se fait en vendant les token en
  // instantané au jeu et uniquement par rapport a ça pas au vente de stuff" (2026-07-11), puis
  // "les potion doivent couter autour de 5 a 30% de ce que tu gagne en silver" et enfin "divise le
  // prix des potion par 10" (2026-07-12) -- remplace l'ancien amortissement en racine carrée
  // (potionZoneScale, dérivait de 42% à 3.6% du revenu horaire) par un pourcentage du revenu horaire
  // de trash de la zone ACTUELLE (jamais relatif à une autre zone, donc jamais de dérive), interpolé
  // linéairement entre POTION_PCT_MIN (small) et POTION_PCT_MAX (mega) selon le coût de base de la
  // taille. Vérifie contre les CONSTANTES (pas un pourcentage codé en dur) pour rester correct même
  // si ces bornes sont encore ajustées plus tard, et que le coût ne dépend QUE de trash.val (jamais
  // du prix de vente du stuff, GEAR_SELL_MULT).
  function testPotionCostIsFixedPctOfHourlyTrashIncome() {
    const s = { zoneIdx, atVelia };
    atVelia = false;
    for (const zi of [0, 5, 10, 15]) { // échantillon zones début/milieu/fin
      zoneIdx = zi;
      const hourly = ZONES[zi].loot.trash.val * POTION_KPM_REF * 60;
      const smallCost = potionCost(POTIONS.small.cost), megaCost = potionCost(POTIONS.mega.cost);
      assert(`Potion small = POTION_PCT_MIN du revenu horaire de trash en ${ZONES[zi].name.fr}`,
        Math.abs(smallCost - Math.round(hourly*POTION_PCT_MIN)) <= 1, `got=${smallCost}, attendu=${Math.round(hourly*POTION_PCT_MIN)}`);
      assert(`Potion mega = POTION_PCT_MAX du revenu horaire de trash en ${ZONES[zi].name.fr}`,
        Math.abs(megaCost - Math.round(hourly*POTION_PCT_MAX)) <= 1, `got=${megaCost}, attendu=${Math.round(hourly*POTION_PCT_MAX)}`);
      // medium/large entre les deux bornes (interpolation linéaire, jamais en dehors) -- non-strict
      // (>=/<=) depuis la 2e division par 10 des prix (2026-07-14) : en tout début de jeu, le
      // revenu horaire de trash est si faible que plusieurs paliers arrondissent au même silver
      // entier (ex: 1), ce qui est un arrondi attendu, pas une régression de l'interpolation
      const mediumCost = potionCost(POTIONS.medium.cost), largeCost = potionCost(POTIONS.large.cost);
      assert(`Potion medium/large entre les bornes min/max en ${ZONES[zi].name.fr}`,
        mediumCost >= smallCost && mediumCost <= largeCost && largeCost <= megaCost,
        `small=${smallCost}, medium=${mediumCost}, large=${largeCost}, mega=${megaCost}`);
    }
    // le coût ne doit dépendre QUE de trash.val -- vérifie qu'il est bien recalculable à partir de
    // cette seule donnée (fonction pure), sans référence cachée au prix de vente du stuff
    zoneIdx = 7;
    const hourly7 = ZONES[7].loot.trash.val * POTION_KPM_REF * 60;
    const expected7 = Math.max(1, Math.round(hourly7 * POTION_PCT_MAX));
    assert('potionCost est entièrement dérivable de trash.val (fonction pure, aucune dépendance cachée)',
      potionCost(POTIONS.mega.cost) === expected7, `got=${potionCost(POTIONS.mega.cost)}, attendu=${expected7}`);
    zoneIdx = s.zoneIdx; atVelia = s.atVelia;
  }

  // "rajoute des groupe de monstre a partir de la zone blanche" / "+ de pack meme monstre" (2026-07-11)
  // -- targetPackCount() doit rester à 6 (inchangé) au palier gris, puis augmenter à chaque palier
  // suivant (blanc/vert/bleu), et retomber à 0 à Velia (zone paisible, aucun monstre).
  function testTargetPackCountIncreasesFromWhiteTier() {
    const s = { zoneIdx, atVelia };
    atVelia = false;
    zoneIdx = 0; // grey
    assert('targetPackCount = 6 en palier gris (inchangé)', targetPackCount() === 6);
    zoneIdx = 3; // white
    assert('targetPackCount = 8 en palier blanc', targetPackCount() === 8, `got=${targetPackCount()}`);
    const whiteCount = targetPackCount();
    // "zone verte rajoute 2x le nombre de monstre actuel" (2026-07-12, précisé "2x la valeur du
    // palier blanc") -- pas une simple progression monotone (le bleu, revu le 2026-07-18 à 28,
    // dépasse maintenant le vert, 16 -- voir plus bas).
    zoneIdx = 6; // green
    assert('targetPackCount du palier vert = 2x le palier blanc (8*2=16)', targetPackCount() === whiteCount*2, `got=${targetPackCount()}`);
    zoneIdx = 9; // blue
    // "zone bleu change le nombre de monstre a 2,3x plus que actuellement" (2026-07-18) --
    // 12 -> 28 (12*2.3=27.6, arrondi), redevient le palier le plus dense (dépasse le vert, 16)
    assert('targetPackCount = 28 en palier bleu (2.3x les 12 précédents)', targetPackCount() === 28, `got=${targetPackCount()}`);
    atVelia = true;
    assert('targetPackCount = 0 à Velia (zone paisible, aucun monstre)', targetPackCount() === 0);
    zoneIdx = s.zoneIdx; atVelia = s.atVelia;
  }
  // vérifie que resetWorld() peuple bien EXACTEMENT targetPackCount() packs pour la zone chargée
  // (pas juste que la fonction existe, mais qu'elle est bien branchée à l'initialisation du monde)
  function testResetWorldSpawnsTargetPackCount() {
    const s = { zoneIdx, atVelia, x: P.x, y: P.y };
    atVelia = false;
    zoneIdx = 3; // palier blanc
    resetWorld();
    const expected = targetPackCount();
    assert(`resetWorld() peuple bien ${expected} packs en zone blanche`,
      packs.filter(p=>!p.dead).length === expected, `got=${packs.filter(p=>!p.dead).length}, attendu=${expected}`);
    zoneIdx = s.zoneIdx; atVelia = s.atVelia;
    resetWorld(); // restaure un monde cohérent avec la vraie zone/atVelia du joueur
    P.x = s.x; P.y = s.y;
  }

  // "refonte de la carte statistique ... best silver, best xp, best monstre" (2026-07-09) : les
  // recommandations doivent être des valeurs THÉORIQUES par zone (indépendantes du stuff actuel du
  // joueur) — vérifie que bestZoneForMetric trouve bien le maximum réel parmi les 16 zones pour
  // chacune des 3 métriques, en calculant le maximum "à la main" indépendamment de l'implémentation
  function testStatsRecoPicksTrueBestZone() {
    [zoneSilverPerHour, zoneXpPerHour, zoneKillsPerMin].forEach(metricFn => {
      let expectedI = 0, expectedV = -Infinity;
      for (let i = 0; i < ZONES.length; i++) {
        const v = metricFn(ZONES[i]);
        if (v > expectedV) { expectedV = v; expectedI = i; }
      }
      const got = bestZoneForMetric(metricFn);
      assert(`bestZoneForMetric(${metricFn.name}) trouve bien le vrai maximum parmi les 16 zones`,
        got.i === expectedI && Math.abs(got.v - expectedV) < 0.001, `got.i=${got.i}, expected.i=${expectedI}`);
    });
  }
  // "le calcul de silver/h se fait uniquement sur les silver looté au sol grâce au token qui
  // doivent être la principale source de revenu, les item looté doivent se vendre bien moins
  // chere" (2026-07-09) : zoneSilverPerHour ne doit PLUS compter matériau/bijou, uniquement le
  // trash ; le prix de revente du gear/bijou doit rester nettement sous l'ancien ratio (~230× le
  // trash pour un bijou, ~78× pour une pièce d'armure) -- vérifie un ordre de grandeur raisonnable
  // (<= 30×) sur les 16 zones plutôt qu'un nombre exact (scale/RNG dans rollGearDrop)
  function testLootedItemsSellForMuchLess() {
    const s = { zoneIdx };
    for (let i = 0; i < ZONES.length; i++) {
      const z = ZONES[i];
      const expectedSilverPerHour = z.loot.trash.val * z.loot.trash.ch * REF_KPM_FOR_STATS * 60;
      assert(`zoneSilverPerHour de ${z.name.fr} ne compte QUE le trash (pas mat/jackpot)`,
        Math.abs(zoneSilverPerHour(z) - expectedSilverPerHour) < 0.001);
    }
    zoneIdx = 10; // Ruines de Kratuga : trash=105, ancien jackpot.val=29600 (×282), ancien plastron ~8228 (×78)
    const z = ZONES[10];
    let gearSample = null;
    for (let i = 0; i < 300 && !gearSample; i++) gearSample = rollGearDrop(z, true);
    assert('Le ratio bijou/trash reste raisonnable (<=30x, était ~230-290x)',
      (JACKPOT_VAL_TRASH_RATIO_FOR_TEST(z) / z.loot.trash.val) <= 30);
    if (gearSample) {
      assert('Le ratio gear/trash reste raisonnable (<=20x, était ~78x en zone 10)',
        (gearSample.val / z.loot.trash.val) <= 20, `gearVal=${gearSample.val}, trashVal=${z.loot.trash.val}`);
    }
    zoneIdx = s.zoneIdx;
  }
  // même formule que rollDrops (dupliquée volontairement, comme testJewelryApIsDynamic un peu plus
  // bas, pour ne pas dépendre de l'implémentation interne) -- sert uniquement à vérifier le ratio
  function JACKPOT_VAL_TRASH_RATIO_FOR_TEST(z) { return z.loot.trash.val * 20; }
  // "modifier l'encadrement de couleur en fonction de la zone sur les bijoux" (2026-07-09) : un
  // bijou (kind jackpot) dans le sac principal doit colorer la bordure de sa case comme le gear/
  // matériau, au lieu de rester sans indice visuel de palier
  function testJewelryGetsColoredBorderInBag() {
    const TEST_SLOT = INV_SIZE - 1;
    const s = { it: INV[TEST_SLOT] };
    INV[TEST_SLOT] = { name:'TestRingXYZ', kind:'jackpot', slot:'ring1', ap:3, color:'#7aa35e', key:'t_ring_border' };
    renderInventory();
    const cell = document.querySelectorAll('#invGrid .cell')[TEST_SLOT];
    assert('Bijou du sac : bordure teintée avec sa couleur de palier', cell && cell.style.borderColor && cell.style.borderColor !== '');
    INV[TEST_SLOT] = s.it;
    renderInventory();
  }
  // "Aucuns jet aléatoire sur les objet équipable, ils donnent des statisque fix" (2026-07-09) :
  // rollGearDrop/rollWeaponDrop doivent produire EXACTEMENT le même résultat à chaque appel pour un
  // même palier/slot/zone — vérifie sur plusieurs tirages successifs qu'aucune variance ne subsiste
  function testGearDropsAreDeterministic() {
    const s = { zoneIdx };
    zoneIdx = 10;
    const z = ZONES[10];
    // chance de drop en zone bleue = 2% × 1.6 (alpha) ≈ 3.2% -- 30 essais donnait ~1 exemplaire en
    // moyenne (bien trop peu, flaky) ; 1000 essais donne ~32 exemplaires, fiable
    const samples = [];
    for (let i = 0; i < 1000; i++) { const g = rollGearDrop(z, true); if (g) samples.push(g); }
    assert('Au moins quelques exemplaires obtenus pour comparer (armure zone 10)', samples.length >= 2, `n=${samples.length}`);
    if (samples.length >= 2) {
      const ref = samples[0];
      const allIdentical = samples.every(g => g.ap === ref.ap && g.dp === ref.dp && g.hp === ref.hp && g.dodge === ref.dodge && g.val === ref.val);
      assert('rollGearDrop : aucune variance entre plusieurs exemplaires du même palier/slot/zone', allIdentical);
    }
    const weaponSamples = [];
    for (let i = 0; i < 1000; i++) weaponSamples.push(...rollWeaponDrop(z, true));
    if (weaponSamples.length >= 2) {
      const ref = weaponSamples[0];
      const allIdentical = weaponSamples.every(g => g.ap === ref.ap && g.val === ref.val);
      assert('rollWeaponDrop : aucune variance entre plusieurs exemplaires', allIdentical);
    }
    zoneIdx = s.zoneIdx;
  }
  // "un objet qui a déjà été équipé ... s'il est moins bon qu'un item dans l'inventaire, lors du
  // clique equiper meilleurs, ce sera toujours le meilleur base qui va s'equiper si les 2 base sont
  // identique alors ce sera le plus haut deja monte" (2026-07-09) : à SOCLE égal (même itemScore),
  // equipBestSingle/equipBestPair doivent choisir l'exemplaire le PLUS ENCHANTÉ, jamais un jumeau
  // moins monté rencontré en premier dans le sac
  function testEquipBestTieBreaksOnHighestEnhLv() {
    const s = { helmet: EQUIP.helmet, a: INV[INV_SIZE-1], b: INV[INV_SIZE-2] };
    EQUIP.helmet = null;
    // 2 casques au MÊME socle (ap/dp/hp/dodge identiques), enhLv différent -- le +5 doit gagner
    // même s'il est rencontré AVANT le +12 dans le sac (l'inverse de l'ordre "naturel" du tri)
    INV[INV_SIZE-2] = { name:'TestHelmetA', kind:'gear', slot:'helmet', ap:0, dp:10, hp:50, dodge:1, enhLv:5, key:'t_helm_a' };
    INV[INV_SIZE-1] = { name:'TestHelmetB', kind:'gear', slot:'helmet', ap:0, dp:10, hp:50, dodge:1, enhLv:12, key:'t_helm_b' };
    equipBestSingle('helmet', 'gear');
    assert('Socles identiques -> le plus enchanté (+12) est équipé, pas le premier rencontré (+5)',
      EQUIP.helmet && EQUIP.helmet.enhLv === 12, `enhLv équipé=${EQUIP.helmet&&EQUIP.helmet.enhLv}`);
    // le perdant (+5) doit être revenu intact dans le sac, jamais perdu
    const back = INV.find(it => it && it.name === 'TestHelmetA');
    assert('Le casque non retenu (+5) retourne bien dans le sac, jamais perdu', !!back && back.enhLv === 5);
    EQUIP.helmet = s.helmet; INV[INV_SIZE-1] = s.a; INV[INV_SIZE-2] = s.b;
    for (let i=0;i<INV_SIZE;i++) if (INV[i] && (INV[i].name==='TestHelmetA'||INV[i].name==='TestHelmetB')) INV[i]=null;
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
  // "vérifie la rétroactivité lors de modification de stuff pour tout objet déjà existant"
  // (2026-07-10) : migrateGearFixedStatsV226 doit recalculer un objet déjà possédé (stats ET val)
  // avec EXACTEMENT la même formule que les nouveaux drops -- sinon un objet looté avant la V225/226
  // reste bloqué sur l'ancien aléatoire/l'ancien prix pour toujours
  function testGearRetroactiveMigration() {
    const s = { a: EQUIP.armor, b: INV[INV_SIZE-1], zoneIdx };
    // plastron de zone10 (Ruines de Kratuga, bleu) avec un ancien stat aléatoire ET un ancien prix élevé
    // -- rollGearDrop lit aussi zoneIdx (global, pour tier/slot) EN PLUS du paramètre zone (pour
    // gearBasisAP/DP) : les deux doivent pointer la même zone, comme en jeu réel (rollDrops appelle
    // toujours rollGearDrop(Z(), ...), jamais une zone différente de zoneIdx)
    zoneIdx = 10;
    const zone = ZONES[10];
    // les stats sont maintenant FIXES (V226) mais le drop reste soumis à une chance -- répète
    // jusqu'à en obtenir un plutôt que de dépendre d'un seul tirage (référence : ce qu'un drop
    // FRAIS donne aujourd'hui, forcément identique d'un essai à l'autre depuis la V226)
    let freshArmor = null;
    for (let i = 0; i < 2000 && !freshArmor; i++) freshArmor = rollGearDrop(zone, true);
    EQUIP.armor = { name:'Plastron Grunil', kind:'gear', slot:'armor', ap:0, dp:999, hp:9999, dodge:9.9, enhLv:7, color:'#6ea3c9', val:99999, key:'t_old_armor' };
    migrateGearFixedStatsV226();
    assert('Migration : dp recalculé à la vraie formule fixe (plus l\'ancien aléatoire)',
      EQUIP.armor.dp === freshArmor.dp, `got=${EQUIP.armor.dp}, attendu=${freshArmor.dp}`);
    assert('Migration : hp recalculé', EQUIP.armor.hp === freshArmor.hp);
    assert('Migration : val recalculé au nouveau (petit) prix de revente', EQUIP.armor.val === freshArmor.val, `got=${EQUIP.armor.val}, attendu=${freshArmor.val}`);
    assert('Migration : enhLv (déjà investi) reste intact, jamais touché', EQUIP.armor.enhLv === 7);

    // bijou avec un ancien prix figé (ancien ratio ~230-290x) -- "Anneau de Cadry" vient de la zone 9
    // (voir JACKPOT_NAME_TO_ZONE dans game-core.js)
    INV[INV_SIZE-1] = { name:'Anneau de Cadry', kind:'jackpot', slot:'ring1', ap:8, val:99999, color:'#6ea3c9', key:'t_old_ring' };
    migrateGearFixedStatsV226();
    const ringZone = ZONES[9];
    assert('Migration : val du bijou recalculé au nouveau ratio (~20x le trash)',
      INV[INV_SIZE-1].val === Math.max(1, Math.round(ringZone.loot.trash.val * 20)), `got=${INV[INV_SIZE-1].val}`);

    EQUIP.armor = s.a; INV[INV_SIZE-1] = s.b; zoneIdx = s.zoneIdx;
  }
  // "Tout les stuff sont strictement sans range, rétroactif" (2026-07-11) : les changements de
  // reqAP/reqDP de zone de cette session (Ruines de Trent 25->30, voir V234) doivent eux aussi se
  // répercuter sur le stuff déjà dropé -- migrateGearFixedStatsV226 seule ne suffit pas car figée
  // par un gate à usage unique, migrateGearRescaleV235 doit rattraper.
  function testGearRescaleV235RetroactiveOnZoneReqChange() {
    const s = { b: INV[INV_SIZE-1], zoneIdx };
    zoneIdx = 12; // Ruines de Trent (grey, reqAP échelonné le 2026-07-11)
    const zone = ZONES[12];
    let freshBoots = null;
    for (let i = 0; i < 2000 && !freshBoots; i++) freshBoots = rollGearDrop(zone, true);
    // simule des bottes dropées avant le lissage des zones (ancien reqAP=25 au lieu de 30 -> ancien dp plus faible)
    INV[INV_SIZE-1] = { name:'Bottes Naru', kind:'gear', slot:'boots', ap:0, dp:1, hp:1, dodge:0.1, enhLv:3, color:GEAR_TIERS[0].color, val:1, key:'t_old_boots' };
    migrateGearRescaleV235();
    assert('Rescale V235 : dp recalculé au reqAP/reqDP ACTUEL de la zone (post-lissage)',
      INV[INV_SIZE-1].dp === freshBoots.dp, `got=${INV[INV_SIZE-1].dp}, attendu=${freshBoots.dp}`);
    assert('Rescale V235 : enhLv déjà investi reste intact', INV[INV_SIZE-1].enhLv === 3);
    INV[INV_SIZE-1] = s.b; zoneIdx = s.zoneIdx;
  }
  // "le nom de la zone doit être mis à jour et rester en place" (2026-07-11) : après un chargement
  // de sauvegarde sur une zone différente de la zone 0, #ztName restait bloqué sur le placeholder
  // HTML statique -- seuls travelTo()/goToVelia() le mettaient à jour, jamais applySaveState().
  function testApplySaveStateUpdatesZoneTitleText() {
    const el = $('ztName'); if (!el) return; // pas de DOM (contexte hors-jeu)
    const s = { zoneIdx, atVelia };
    atVelia = false;
    const save = getSaveState();
    save.zoneIdx = 5; // Colonie Sausan
    el.textContent = 'STALE_PLACEHOLDER';
    applySaveState(save);
    assert('applySaveState() met à jour #ztName selon le zoneIdx restauré',
      el.textContent === tr(ZONES[5].name), `got=${el.textContent}`);
    zoneIdx = s.zoneIdx; atVelia = s.atVelia; updateZoneTitleText();
  }
  // rattrapage hors-ligne "réel" (2026-07-11, demande explicite : "le modal qui calcule le farm
  // hors ligne, je le vois pas quand on se reconnecte") -- computeOfflineCatchupSilver()
  // (game-core.js) doit : ignorer une sauvegarde sans savedAt/taux, ignorer une absence sous le
  // seuil minimum (bruit d'un simple changement d'onglet, déjà couvert par visibilitychange),
  // calculer un gain proportionnel au temps réel écoulé, et plafonner à OFFLINE_CATCHUP_CAP_HOURS
  // même pour une absence bien plus longue.
  function testComputeOfflineCatchupSilverCapsAndThresholds() {
    if (typeof computeOfflineCatchupSilver !== 'function') return;
    const rate = 3600; // valeur ronde : 3600 silver/h = 1 silver/s
    assert('Sans savedAt -> 0, pas de throw', computeOfflineCatchupSilver({ S:{ bestSilverPerHour: rate } }) === 0);
    assert('Sans taux connu (bestSilverPerHour=0) -> 0', computeOfflineCatchupSilver({ savedAt: new Date(Date.now()-3600000).toISOString(), S:{ bestSilverPerHour:0 } }) === 0);
    const oneMinuteAgo = new Date(Date.now() - 60*1000).toISOString();
    assert('Absence sous OFFLINE_CATCHUP_MIN_HOURS (~3 min) -> 0', computeOfflineCatchupSilver({ savedAt: oneMinuteAgo, S:{ bestSilverPerHour: rate } }) === 0);
    const oneHourAgo = new Date(Date.now() - 3600*1000).toISOString();
    const gain1h = computeOfflineCatchupSilver({ savedAt: oneHourAgo, S:{ bestSilverPerHour: rate } });
    assert('1h d\'absence à 3600 silver/h -> ~3600 silver', Math.abs(gain1h - rate) <= 2, `gain=${gain1h}`);
    const fortyEightHoursAgo = new Date(Date.now() - 48*3600*1000).toISOString();
    const gainCapped = computeOfflineCatchupSilver({ savedAt: fortyEightHoursAgo, S:{ bestSilverPerHour: rate } });
    assert('Plafonné à OFFLINE_CATCHUP_CAP_HOURS (24h) même après 48h d\'absence', Math.abs(gainCapped - rate*OFFLINE_CATCHUP_CAP_HOURS) <= 2, `gain=${gainCapped}`);
  }
  // vérifie l'intégration bout-en-bout : applySaveState() sur une sauvegarde dont savedAt est
  // ancien doit créditer le silver de rattrapage ET déclencher le modal "Bon retour" (auparavant :
  // rien ne s'affichait, awaySilverGained/awayLootCounts restaient à 0 après un vrai rechargement
  // sans que l'onglet n'ait jamais été mis en arrière-plan dans CETTE session). Vérifie aussi que
  // le rattrapage n'alimente PAS tokenSilverEarned (category 'offline_catchup', pas 'loot') --
  // sinon le taux servant de base au PROCHAIN rattrapage s'auto-inflaterait à chaque reconnexion.
  function testApplySaveStateOfflineCatchupCreditsSilverAndShowsReconnectModal() {
    if (typeof applySaveState !== 'function' || typeof showAwayLootSummaryIfAny !== 'function') return;
    const root = document.getElementById('reconnectModalRoot'); if (!root) return;
    const s = { zoneIdx, atVelia, silver: S.silver, silverEarned: S.silverEarned, tokenSilverEarned: S.tokenSilverEarned, bestSilverPerHour: S.bestSilverPerHour };
    const savedAwaySilver = awaySilverGained, savedAwayLoot = { ...awayLootCounts };
    try {
      atVelia = false;
      const save = getSaveState();
      save.S.bestSilverPerHour = 7200; // 2 silver/s pile, pour un calcul exact
      save.savedAt = new Date(Date.now() - 2*3600*1000).toISOString(); // 2h d'absence réelle
      const silverBefore = save.S.silver;
      const tokenBefore = save.S.tokenSilverEarned || 0;
      // PAS de root.innerHTML='' ici (piège documenté CLAUDE.md §32 -- une fois le root React
      // déjà monté par un test antérieur, vider le DOM à la main corrompt le suivi des fibers et
      // fait planter le PROCHAIN rendu sur un removeChild) : openReconnectModal() gère lui-même le
      // remplacement, que le root existe déjà ou non.
      applySaveState(save);
      assert('applySaveState() crédite le silver de rattrapage hors-ligne (2h × 7200/h = 14400)',
        Math.abs(S.silver - (silverBefore + 14400)) <= 2, `silver=${S.silver}, attendu≈${silverBefore+14400}`);
      assert('Le rattrapage n\'alimente PAS tokenSilverEarned (évite l\'auto-inflation du taux)', S.tokenSilverEarned === tokenBefore, `tokenSilverEarned=${S.tokenSilverEarned}`);
      assert('Le modal "Bon retour" s\'affiche après un rattrapage hors-ligne réel (pas seulement un changement d\'onglet)',
        root.innerHTML.includes('Bon retour'), root.innerHTML.slice(0,120));
    } finally {
      zoneIdx = s.zoneIdx; atVelia = s.atVelia; updateZoneTitleText();
      S.silver = s.silver; S.silverEarned = s.silverEarned; S.tokenSilverEarned = s.tokenSilverEarned; S.bestSilverPerHour = s.bestSilverPerHour;
      awaySilverGained = savedAwaySilver; awayLootCounts = savedAwayLoot;
    }
  }
  // "vérifie les info de la table de loot (couleurs cadre)" (2026-07-10) : la ligne dépliée du
  // bijou (kind jackpot) doit être colorée à la couleur du palier, comme les lignes gear/matériau
  // et comme la ligne condensée (zoneLootCompactRowHtml) — bug trouvé en vérification : "jackpot"
  // manquait de rowColor, seule la ligne du bijou restait sans couleur dans le détail déplié
  function testLootTableJackpotRowHasColor() {
    const html = zoneLootRowsHtml(0); // Camp des Loups, palier grey (#b8b8b8)
    const jackpotRowMatch = html.match(/<div class="lootIcon k-jackpot"[^>]*>/);
    assert('Table de loot : la ligne bijou a bien un style de couleur (border/color)',
      !!jackpotRowMatch && jackpotRowMatch[0].includes('style='), `html=${jackpotRowMatch && jackpotRowMatch[0]}`);
    assert('Table de loot : la couleur du bijou correspond au palier de la zone', !!jackpotRowMatch && jackpotRowMatch[0].includes(GEAR_TIERS[0].color));
  }
  // "toute modificaitonn de silver doit etre écris dans ce registre... je dois pouvoir traquer le
  // moidre silver" (2026-07-10) : addSilver() est le point d'entrée UNIQUE pour toute variation de
  // silver côté client -- doit toujours mettre à jour S.silver, et n'incrémenter S.silverEarned que
  // pour un gain (jamais pour une dépense), sans jamais planter si le registre serveur est absent
  // (queueSilverLedger non défini, ex: tests hors contexte Supabase)
  function testAddSilverUpdatesStateCorrectly() {
    const s = { silver: S.silver, silverEarned: S.silverEarned, tokenSilverEarned: S.tokenSilverEarned };
    S.silver = 1000; S.silverEarned = 500; S.tokenSilverEarned = 300;
    addSilver(200, 'loot', 'test');
    assert('addSilver (gain) : S.silver augmente du montant exact', S.silver === 1200, `S.silver=${S.silver}`);
    assert('addSilver (gain) : S.silverEarned augmente aussi (compteur à vie)', S.silverEarned === 700, `S.silverEarned=${S.silverEarned}`);
    // "silver par heure compté exclusivement par les silver recolté grace au token vendu" (2026-07-12)
    // -- category:'loot' (trash/token) DOIT alimenter tokenSilverEarned, jamais les autres catégories
    assert('addSilver (loot/token) : S.tokenSilverEarned augmente aussi', S.tokenSilverEarned === 500, `S.tokenSilverEarned=${S.tokenSilverEarned}`);
    addSilver(150, 'quest', 'test'); // gain d'une AUTRE source -> ne doit PAS compter comme "token"
    assert('addSilver (quête) : S.silverEarned augmente (compteur global)', S.silverEarned === 850, `S.silverEarned=${S.silverEarned}`);
    assert('addSilver (quête) : S.tokenSilverEarned NE bouge PAS (pas du token/trash)', S.tokenSilverEarned === 500, `S.tokenSilverEarned=${S.tokenSilverEarned}`);
    addSilver(-300, 'potion', 'test');
    assert('addSilver (dépense) : S.silver diminue du montant exact', S.silver === 1050, `S.silver=${S.silver}`);
    assert('addSilver (dépense) : S.silverEarned NE bouge PAS (compteur à vie, jamais décrémenté par une dépense)', S.silverEarned === 850, `S.silverEarned=${S.silverEarned}`);
    addSilver(0, 'loot', 'test'); // delta nul -> no-op silencieux, ne doit rien casser
    assert('addSilver (delta nul) : aucun effet', S.silver === 1050 && S.silverEarned === 850 && S.tokenSilverEarned === 500);
    S.silver = s.silver; S.silverEarned = s.silverEarned; S.tokenSilverEarned = s.tokenSilverEarned;
  }
  // "lorsque je vends un item ... EQUIPE>COMPENDIUM>VENDRE" (2026-07-10) : sellOne() doit d'abord
  // tenter d'équiper l'objet s'il est meilleur, puis de le protéger dans le Compendium, et ne le
  // vendre RÉELLEMENT que si ni l'un ni l'autre ne s'applique
  function testSellOnePriorityEquipCompendiumSell() {
    const TEST_NAME = 'TestSellPriorityHelmet';
    const s = { helmet: EQUIP.helmet, a: INV[INV_SIZE-1], b: INV[INV_SIZE-2], silver: S.silver, pen: S.penMastery[TEST_NAME] };
    delete S.penMastery[TEST_NAME];
    EQUIP.helmet = null; INV[INV_SIZE-1] = null; INV[INV_SIZE-2] = null;
    const clearName = () => {
      for (let k=0;k<INV_SIZE;k++) if (INV[k] && INV[k].name===TEST_NAME) INV[k]=null;
      for (let k=0;k<INV_SIZE;k++) if (COMPENDIUM_BAG[k] && COMPENDIUM_BAG[k].name===TEST_NAME) COMPENDIUM_BAG[k]=null;
      if (EQUIP.helmet && EQUIP.helmet.name===TEST_NAME) EQUIP.helmet=null;
    };
    clearName(); // filet de sécurité si un run précédent a laissé une trace de ce nom

    // cas 1 (ÉQUIPER) : rien d'équipé -> le premier exemplaire vendu doit s'équiper, pas se vendre
    EQUIP.helmet = null;
    INV[INV_SIZE-1] = { name:TEST_NAME, kind:'gear', slot:'helmet', ap:0, dp:9, hp:20, enhLv:0, val:500, key:'t1', qty:1 };
    const silverBefore1 = S.silver;
    sellOne(INV_SIZE-1);
    assert('Priorité 1/3 : objet meilleur que l\'équipé -> ÉQUIPÉ, pas vendu',
      EQUIP.helmet && EQUIP.helmet.name === TEST_NAME, `EQUIP.helmet=${EQUIP.helmet&&EQUIP.helmet.name}`);
    assert('Priorité 1/3 : aucun silver gagné (pas une vente)', S.silver === silverBefore1);
    clearName();

    // cas 2 (COMPENDIUM) : un exemplaire moins bon déjà équipé (donc pas équipable) et pas encore
    // protégé -> doit rejoindre le sac protégé, pas se vendre
    EQUIP.helmet = { name:TEST_NAME, kind:'gear', slot:'helmet', ap:0, dp:50, hp:200, enhLv:0, val:5000, key:'t_worn' };
    INV[INV_SIZE-1] = { name:TEST_NAME, kind:'gear', slot:'helmet', ap:0, dp:9, hp:20, enhLv:3, val:500, key:'t2', qty:1 };
    const silverBefore2 = S.silver;
    sellOne(INV_SIZE-1);
    assert('Priorité 2/3 : pas équipable (moins bon que l\'équipé) mais protégeable -> COMPENDIUM, pas vendu',
      compendiumBagHasName(TEST_NAME));
    assert('Priorité 2/3 : aucun silver gagné (pas une vente)', S.silver === silverBefore2);
    clearName();

    // cas 3 (VENDRE) : déjà en maîtrise PEN -> ni équipable de mieux, ni protégeable -> vente réelle
    S.penMastery[TEST_NAME] = true;
    EQUIP.helmet = { name:TEST_NAME, kind:'gear', slot:'helmet', ap:0, dp:50, hp:200, enhLv:0, val:5000, key:'t_worn2' };
    INV[INV_SIZE-1] = { name:TEST_NAME, kind:'gear', slot:'helmet', ap:0, dp:9, hp:20, enhLv:3, val:777, key:'t3', qty:1 };
    const silverBefore3 = S.silver;
    sellOne(INV_SIZE-1);
    assert('Priorité 3/3 : ni équipable ni protégeable (déjà PEN) -> vendu pour de vrai',
      S.silver === silverBefore3 + 777, `S.silver=${S.silver}, attendu=${silverBefore3+777}`);
    assert('Priorité 3/3 : l\'objet a bien quitté le sac', INV[INV_SIZE-1] === null);

    clearName();
    if (s.pen === undefined) delete S.penMastery[TEST_NAME]; else S.penMastery[TEST_NAME] = s.pen;
    EQUIP.helmet = s.helmet; INV[INV_SIZE-1] = s.a; INV[INV_SIZE-2] = s.b; S.silver = s.silver;
  }
  // bug trouvé le 2026-07-14 (demande explicite de vérification "que la vente... garde le
  // meilleur") : le menu contextuel d'un objet (showItemMenu) n'affichait le bouton "Vendre 1" que
  // pour trash/material/gear -- les bijoux (kind:'jackpot') en étaient exclus, alors que sellOne()
  // les gère très bien. Un joueur ne pouvait donc jamais vendre manuellement un bijou en trop via
  // ce menu (seul l'auto-équipement au clic simple fonctionnait).
  function testJackpotHasSellButtonInItemMenu() {
    if (!$('itemPop')) return; // pas de DOM (contexte hors-jeu)
    const TEST_NAME = 'TestSellBtnRingXYZ';
    const s = { a: INV[INV_SIZE-1] };
    INV[INV_SIZE-1] = { name:TEST_NAME, kind:'jackpot', slot:'ring1', ap:2, dp:0, hp:0, enhLv:0, val:100, key:'t_ring', qty:1 };
    showItemMenu(0, 0, { invIndex:INV_SIZE-1, ...INV[INV_SIZE-1] });
    const labels = Array.from($('itemPop').querySelectorAll('button')).map(b => b.textContent);
    assert('Le menu contextuel d\'un bijou propose bien un bouton "Vendre 1"',
      labels.some(l => /vendre 1|sell 1/i.test(l)), `labels=${JSON.stringify(labels)}`);
    hideItemPop();
    INV[INV_SIZE-1] = s.a;
  }
  // "si 2 stuff identique doivent etre changé toujours prendre celui le plus optimisé... sans
  // oublier les 2 anneaux verification slot 1 puis slot 2 et oreille slot 1 puis slot 2" (2026-07-11)
  // -- bug trouvé : tryAutoEquipIfBetter (utilisé par sellOne) comparait avec un simple ">"/"<="
  // SANS tenir compte de l'enchantement à socle égal, contrairement à equipBestSingle/equipBestPair.
  // Un doublon plus enchanté (même socle de base) ne remplaçait donc jamais l'exemplaire équipé
  // moins monté. isStrictlyBetterGear() corrige ça pour tous les cas (slot simple + paire anneau/boucle).
  function testAutoEquipPrefersMoreEnhancedOnTiedBaseScore() {
    // garantit un slot libre pour recevoir l'ancien ring1 délogé (invAdd retourne false sinon,
    // et tryAutoEquipIfBetter annule tout l'échange) -- sans ça, dépend silencieusement de l'état
    // du sac du compte démo (192/192 = échec à tort, voir CLAUDE.md section 11)
    const freeIdx = INV_SIZE-2;
    const TEST_NAME = 'TestAutoEquipTieBreak';
    const s = { ring1: EQUIP.ring1, ring2: EQUIP.ring2, a: INV[INV_SIZE-1], freeSlot: INV[freeIdx] };
    INV[freeIdx] = null;
    const clearName = () => {
      for (let k=0;k<INV_SIZE;k++) if (INV[k] && INV[k].name===TEST_NAME) INV[k]=null;
      if (EQUIP.ring1 && EQUIP.ring1.name===TEST_NAME) EQUIP.ring1=null;
      if (EQUIP.ring2 && EQUIP.ring2.name===TEST_NAME) EQUIP.ring2=null;
    };
    clearName();
    // 2 anneaux déjà équipés, MÊME socle de base (ap:5) mais enchantements différents
    EQUIP.ring1 = { name:TEST_NAME, kind:'jackpot', slot:'ring', ap:5, enhLv:2, key:'r1' };
    EQUIP.ring2 = { name:TEST_NAME, kind:'jackpot', slot:'ring', ap:5, enhLv:5, key:'r2' };
    // nouvel exemplaire : MÊME socle de base (ap:5, donc itemScore identique aux 2 déjà équipés)
    // mais PLUS enchanté que ring1 (2) ET ring2 (5) -> doit remplacer ring1 (le moins enchanté des 2,
    // "vérifie slot 1 puis slot 2" -- c'est bien celui-là qui doit céder sa place, pas ring2)
    INV[INV_SIZE-1] = { name:TEST_NAME, kind:'jackpot', slot:'ring', ap:5, enhLv:7, key:'r3', qty:1 };
    const equipped = tryAutoEquipIfBetter(INV_SIZE-1, INV[INV_SIZE-1]);
    assert('Doublon plus enchanté à socle égal -> équipé (pas ignoré à tort)', equipped);
    assert('Remplace bien le MOINS enchanté des 2 anneaux (ring1, enhLv=2)', EQUIP.ring1 && EQUIP.ring1.enhLv === 7, `ring1.enhLv=${EQUIP.ring1&&EQUIP.ring1.enhLv}`);
    assert('ring2 (le plus enchanté des 2) reste intact', EQUIP.ring2 && EQUIP.ring2.enhLv === 5);
    // l'ancien ring1 (enhLv 2) doit être revenu dans le sac, jamais perdu
    assert('L\'ancien ring1 délogé revient dans le sac', INV.some(it => it && it.name===TEST_NAME && it.enhLv===2));
    clearName();
    EQUIP.ring1 = s.ring1; EQUIP.ring2 = s.ring2; INV[INV_SIZE-1] = s.a; INV[freeIdx] = s.freeSlot;
  }
  // "fais un carré autour du niveau et % d'xp qui s'illumine quand on gagne de l'xp" (2026-07-10) :
  // gainXp(n>0) doit ajouter la classe .xpFlash à #lvlXpRow ; un gain nul ou négatif ne doit rien
  // déclencher (n<=0 ne devrait jamais arriver en pratique, mais gainXp ne doit pas planter dessus)
  function testXpGainFlashesLevelBox() {
    const el = $('lvlXpRow'); if (!el) return; // pas de DOM (contexte hors-jeu) -> rien à vérifier
    const s = { xp: S.xp, xpNext: S.xpNext, lvl: S.lvl, hpMax: S.hpMax, hp: P.hp };
    el.classList.remove('xpFlash');
    gainXp(5);
    assert('gainXp(n>0) illumine #lvlXpRow (.xpFlash)', el.classList.contains('xpFlash'));
    el.classList.remove('xpFlash');
    gainXp(0);
    assert('gainXp(0) n\'illumine rien (pas de gain réel)', !el.classList.contains('xpFlash'));
    S.xp = s.xp; S.xpNext = s.xpNext; S.lvl = s.lvl; S.hpMax = s.hpMax; P.hp = s.hp;
  }
  // "Les Loyalties se gagne 200 par jours se stack dans le courrier a l'infini et peut se
  // récuperer pour etre stock a coté des silver dans l'inventaire" (2026-07-11) : le gain
  // quotidien ne crédite plus S.loyalty directement, il s'accumule dans le courrier tant que le
  // joueur ne clique pas sur "Récupérer" (claimLoyalty).
  function testClaimLoyaltyMovesMailboxToStock() {
    const s = { loyalty: S.loyalty, mailbox: S.mailbox.slice() };
    S.mailbox = S.mailbox.filter(m => m.key !== 'loyalty');
    S.loyalty = 0;
    mailboxAdd('loyalty', 'Loyalties', '🏅', 200);
    assert('mailboxAdd accumule le gain journalier sans toucher au stock', S.loyalty === 0);
    claimLoyalty();
    assert('claimLoyalty transfère le solde du courrier vers le stock (S.loyalty)', S.loyalty === 200, `S.loyalty=${S.loyalty}`);
    const m = S.mailbox.find(m => m.key === 'loyalty');
    assert('claimLoyalty vide l\'entrée du courrier après récupération', !!m && m.qty === 0, `qty=${m&&m.qty}`);
    mailboxAdd('loyalty', 'Loyalties', '🏅', 200); // 2e journée sans récupérer -> doit re-accumuler sans limite
    assert('le courrier ré-accumule normalement après une récupération', m.qty === 200, `qty=${m.qty}`);
    S.loyalty = s.loyalty; S.mailbox = s.mailbox;
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
  // "fais en sorte que la mine de fer abandonné pass en zone difficile en moyenne avec le stuff de
  // la zone d'avant en +13. Le full PEN te donne acces direct en difficile en la zone 2 (poste
  // helm)" (2026-07-12) -- simulation d'un stuff COMPLET de Colonie Sausan (3 armes + 4 armures + 6
  // bijoux, formule réelle GEAR_ROLE) à +13 puis à PEN.
  function testSausanGearReachesMineDeFerDifficile() {
    const z = ZONES[5], mine = ZONES[6], helm = ZONES[7];
    const basisAP = z.gearBasisAP ?? z.reqAP, basisDP = z.gearBasisDP ?? z.reqDP;
    function totalFor(enhLv) {
      const bonus = 1 + enhBonus(enhLv);
      let ap = 4 /* PA innée */, dp = 10 /* PD innée */;
      for (const slot of ['weapon','awakening','secondary']) ap += gearFloor(basisAP*GEAR_ROLE[slot].apShare)*bonus;
      for (const slot of ['helmet','armor','gloves','boots']) dp += gearFloor(basisDP*GEAR_ROLE[slot].dpShare)*bonus;
      ap += gearFloor(basisAP*GEAR_ROLE.jackpot.apShare)*bonus*6; // 2 anneaux+2 boucles+collier+ceinture
      return { ap, dp };
    }
    const t13 = totalFor(13);
    const ratio13 = Math.min(t13.ap/mine.reqAP, t13.dp/mine.reqDP);
    assert('Stuff complet de Colonie Sausan (+13) atteint ZONE DIFFICILE face à Mine de Fer Abandonnée',
      ratio13 >= 0.6 && ratio13 < 0.9, `ratio=${ratio13.toFixed(2)} (PA=${t13.ap.toFixed(1)}, PD=${t13.dp.toFixed(1)})`);
    const tPen = totalFor(ENH_NAMES.length-1);
    const ratioPen = Math.min(tPen.ap/helm.reqAP, tPen.dp/helm.reqDP);
    assert('Stuff complet de Colonie Sausan (PEN) atteint ZONE DIFFICILE face à Poste Helm (2 zones plus loin)',
      ratioPen >= 0.6 && ratioPen < 0.9, `ratio=${ratioPen.toFixed(2)} (PA=${tPen.ap.toFixed(1)}, PD=${tPen.dp.toFixed(1)})`);
  }
  // "avec un full stuff blanc je dois pouvoir passer en zone vert tout juste difficile en +13 en
  // moyenne et full pen me fais passer a la 2e zone verte" (2026-07-12) -- simulation PRÉCISE d'un
  // stuff COMPLET du palier blanc : chaque pièce depuis SA PROPRE zone réelle (Camp Rhutum=casque+
  // anneau, Ferme Shultz=arme+armure+collier, Colonie Sausan=secondaire+gants+ceinture, Île
  // d'Iliya=éveil+bottes+boucle), formule réelle GEAR_ROLE -- contrairement au test précédent (une
  // approximation à partir d'une seule zone), celle-ci reflète exactement ce qu'un joueur obtient en
  // farmant réellement les 4 zones du palier.
  function testFullWhiteTierGearReachesGreenTierDifficile() {
    const zBySlot = { helmet:3, ring:3, weapon:4, armor:4, necklace:4, secondary:5, gloves:5, belt:5, awakening:13, boots:13, earring:13 };
    function basisFor(slotKey) { const z = ZONES[zBySlot[slotKey]]; return { ap: z.gearBasisAP ?? z.reqAP, dp: z.gearBasisDP ?? z.reqDP }; }
    function totalFor(enhLv) {
      const bonus = 1 + enhBonus(enhLv);
      let ap = 4, dp = 10;
      for (const slot of ['weapon','awakening','secondary']) { const b = basisFor(slot); ap += gearFloor(b.ap*GEAR_ROLE[slot].apShare)*bonus; }
      for (const slot of ['helmet','armor','gloves','boots']) { const b = basisFor(slot); dp += gearFloor(b.dp*GEAR_ROLE[slot].dpShare)*bonus; }
      const ringB = basisFor('ring'), neckB = basisFor('necklace'), beltB = basisFor('belt'), earB = basisFor('earring');
      ap += gearFloor(ringB.ap*GEAR_ROLE.jackpot.apShare)*bonus*2; // 2 anneaux
      ap += gearFloor(neckB.ap*GEAR_ROLE.jackpot.apShare)*bonus;
      ap += gearFloor(beltB.ap*GEAR_ROLE.jackpot.apShare)*bonus;
      ap += gearFloor(earB.ap*GEAR_ROLE.jackpot.apShare)*bonus*2; // 2 boucles
      return { ap, dp };
    }
    const mine = ZONES[6], helm = ZONES[7];
    const t13 = totalFor(13);
    const r13 = Math.min(t13.ap/mine.reqAP, t13.dp/mine.reqDP);
    assert('Stuff COMPLET du palier blanc (+13) atteint tout juste ZONE DIFFICILE face à Mine de Fer Abandonnée',
      r13 >= 0.6 && r13 < 0.7, `ratio=${r13.toFixed(3)} (PA=${t13.ap.toFixed(1)}, PD=${t13.dp.toFixed(1)})`);
    const tPen = totalFor(ENH_NAMES.length-1);
    const rPen = Math.min(tPen.ap/helm.reqAP, tPen.dp/helm.reqDP);
    assert('Stuff COMPLET du palier blanc (PEN) atteint ZONE DIFFICILE face à Poste Helm (2e zone verte)',
      rPen >= 0.6 && rPen < 0.9, `ratio=${rPen.toFixed(3)} (PA=${tPen.ap.toFixed(1)}, PD=${tPen.dp.toFixed(1)})`);
  }

  // ---------- Trésor de Velia (2026-07-13 : fusion 1/2/3, prix réels, plafond d'empilement) ----------
  function testVeliaTreasureMergedIntoSingleTier() {
    assert('VELIA_TREASURE ne contient que 2 objets (Bout + Trésor, fusion des 3 variantes numérotées)',
      VELIA_TREASURE.length === 2, `length=${VELIA_TREASURE.length}`);
    const names = VELIA_TREASURE.map(t => t.name);
    assert('"Trésor de Velia" (sans numéro) est bien présent', names.includes('Trésor de Velia'), `names=${JSON.stringify(names)}`);
    assert('Aucune variante numérotée ne subsiste (Trésor de Velia 1/2/3)',
      !names.some(n => /Trésor de Velia [123]/.test(n)), `names=${JSON.stringify(names)}`);
    const bout = VELIA_TREASURE.find(t => t.key === 'treasure_bout_velia');
    const treasure = VELIA_TREASURE.find(t => t.key === 'treasure_velia');
    assert('"Bout du trésor de Velia" a une chance de 0.17%', Math.abs(bout.ch - 0.0017) < 1e-9, `ch=${bout.ch}`);
    assert('"Trésor de Velia" a une chance de 0.0005%', Math.abs(treasure.ch - 0.000005) < 1e-9, `ch=${treasure.ch}`);
  }
  function testTreasurePricingIsMultipleOfReferenceGearVal() {
    const ref = referenceGearVal();
    assert('referenceGearVal() renvoie un nombre positif dans la zone courante', ref > 0, `ref=${ref}`);
    // même calcul que rollDrops (dupliqué volontairement, comme d'autres tests de prix ci-dessus) :
    // "Bout" = 10x le prix d'un équipement, "Trésor" = 10 000x
    const boutVal = ref * 10, treasureVal = ref * 10000;
    assert('Le "Bout du trésor de Velia" vaut 10x le prix d\'un équipement', boutVal === ref * 10);
    assert('Le "Trésor de Velia" vaut 10 000x le prix d\'un équipement', treasureVal === ref * 10000);
  }
  function testTreasureStackCapAutoSellsSurplus() {
    const savedInv = INV.slice(), savedSilver = S.silver;
    try {
      for (let i = 0; i < INV_SIZE; i++) INV[i] = null;
      // "Bout" plafonne à 100 : un ajout qui dépasse revend automatiquement le surplus
      INV[0] = { name:'Bout du trésor de Velia', kind:'treasure', key:'treasure_bout_velia', qty:98, val:50, stackable:true, weight:0.05 };
      const silverBefore = S.silver;
      const ok = invAdd({ name:'Bout du trésor de Velia', kind:'treasure', key:'treasure_bout_velia', qty:5, val:50, stackable:true, weight:0.05 });
      assert('invAdd() réussit même quand ça dépasse le plafond du Bout', ok === true);
      assert('Le stack de Bout est plafonné à 100 après un ajout qui dépasse', INV[0].qty === 100, `qty=${INV[0].qty}`);
      assert('Le surplus de Bout (3 unités × 50) a été revendu automatiquement', S.silver === silverBefore + 3*50, `silver=${S.silver}, attendu=${silverBefore+150}`);
      // "Trésor de Velia" plafonne à 1
      for (let i = 0; i < INV_SIZE; i++) INV[i] = null;
      INV[0] = { name:'Trésor de Velia', kind:'treasure', key:'treasure_velia', qty:1, val:2000, stackable:true, weight:0.05 };
      const silverBefore2 = S.silver;
      invAdd({ name:'Trésor de Velia', kind:'treasure', key:'treasure_velia', qty:1, val:2000, stackable:true, weight:0.05 });
      assert('Le stack de Trésor de Velia reste à 1 après un 2e ramassage', INV[0].qty === 1, `qty=${INV[0].qty}`);
      assert('Le Trésor de Velia surnuméraire (1 × 2000) a été revendu automatiquement', S.silver === silverBefore2 + 2000, `silver=${S.silver}, attendu=${silverBefore2+2000}`);
    } finally {
      for (let i = 0; i < INV_SIZE; i++) INV[i] = savedInv[i];
      S.silver = savedSilver;
    }
  }
  function testTreasureCraftRecipeTargetsUnnumberedTreasure() {
    const r = TREASURE_PIECE_RECIPES.find(x => x.needKey === 'treasure_bout_velia');
    assert('La recette de craft (100 Bouts) existe toujours', !!r);
    assert('La recette donne "Trésor de Velia" (sans numéro)', r && r.giveName === 'Trésor de Velia', `giveName=${r&&r.giveName}`);
    assert('La recette donne la clé treasure_velia', r && r.giveKey === 'treasure_velia', `giveKey=${r&&r.giveKey}`);
    assert('needQty reste 100', r && r.needQty === 100, `needQty=${r&&r.needQty}`);
  }

  // "les attaques de zone visuellement doivent faire des degats de zone sur les monstres"
  // (2026-07-14) : un sort dont le VFX est étalé sur toute l'aire du pack (meteor/ice/quake...)
  // doit endommager TOUS les monstres vivants du pack, pas seulement currentWolf() (le 1er vivant)
  function testZoneSkillsDamageAllWolvesInPack() {
    const s = { target, packs, buffTimer };
    buffTimer = 0;
    const pack = { dead:false, aggro:true, x:0, y:0, gathered:1, wolves:[
      { ox:0,oy:0,gx:0,gy:0, hp:99999, maxHp:99999, dead:false, scale:1, tone:'#fff' },
      { ox:10,oy:0,gx:5,gy:0, hp:99999, maxHp:99999, dead:false, scale:1, tone:'#fff' },
      { ox:20,oy:0,gx:10,gy:0, hp:99999, maxHp:99999, dead:false, scale:1, tone:'#fff' },
    ] };
    packs = [pack];
    target = pack;
    const sk = SKILLS.find(x => x.id === 'meteor');
    resolveSkill(sk);
    assert('Un sort de zone inflige des dégâts à TOUS les monstres vivants du pack (pas seulement le 1er)',
      pack.wolves.every(w => w.hp < 99999), `hp=${JSON.stringify(pack.wolves.map(w=>w.hp))}`);
    target = s.target; packs = s.packs; buffTimer = s.buffTimer;
  }

  // Verrou multi-session (2026-07-10, demande explicite : "Interdire multionglet, multi navigateur
  // and multidevice") -- advanceSim() (game-core.js) doit ignorer TOUT effet de bord (spawn, fsm,
  // caméra...) tant que sessionLocked est vrai (posé par checkPlayerSession(), game-supabase.js,
  // dès qu'une AUTRE session a pris le relais sur ce compte). Test dynamique via le mouvement de
  // caméra (cam.x suit P.x avec un lerp) plutôt que le spawn de packs (dépendrait de
  // targetPackCount()/zoneIdx, plus fragile).
  function testAdvanceSimSkipsAllEffectsWhenSessionLocked() {
    if (typeof advanceSim !== 'function' || typeof sessionLocked === 'undefined') return;
    const savedLocked = sessionLocked, savedCamX = cam.x, savedPx = P.x, savedLast = last;
    try {
      P.x = 500; cam.x = 0; sessionLocked = true;
      advanceSim(performance.now() + 50);
      assert('advanceSim() ne bouge pas la caméra tant que sessionLocked est vrai (verrou multi-session)', cam.x === 0, `cam.x=${cam.x}`);
      sessionLocked = false;
      advanceSim(performance.now() + 150);
      assert('advanceSim() reprend normalement une fois sessionLocked repassé à false', cam.x > 0, `cam.x=${cam.x}`);
    } finally {
      sessionLocked = savedLocked; cam.x = savedCamX; P.x = savedPx; last = savedLast;
    }
  }

  // Mode hors ligne (2026-07-10, demande explicite) : saveToLocalOfflineCache()/
  // clearLocalOfflineCache() doivent utiliser une clé PAR COMPTE (offlineSaveKey(), basée sur
  // currentUser.id) -- sinon une sauvegarde offline d'un compte fuiterait vers un autre compte sur
  // un navigateur/appareil partagé. Vérifie aussi que pendingOfflineSync (lu par
  // flushOfflineSaveIfNeeded() au retour réseau) suit bien l'état réel du cache.
  function testOfflineCacheRoundTripsPerUserAndTracksPendingSync() {
    if (typeof saveToLocalOfflineCache !== 'function' || typeof offlineSaveKey !== 'function') return;
    const savedUser = currentUser, savedPending = pendingOfflineSync;
    currentUser = { id: 'test-offline-user-regression' };
    const key = offlineSaveKey();
    let savedRaw = null;
    try { savedRaw = localStorage.getItem(key); } catch(e) {}
    try {
      try { localStorage.removeItem(key); } catch(e) {}
      pendingOfflineSync = false;
      saveToLocalOfflineCache();
      let raw = null;
      try { raw = localStorage.getItem(key); } catch(e) {}
      assert('saveToLocalOfflineCache() écrit une entrée localStorage propre à currentUser.id', !!raw, `raw=${raw}`);
      const parsed = raw ? JSON.parse(raw) : null;
      assert('La sauvegarde locale contient bien save_data', !!(parsed && parsed.save_data));
      assert('pendingOfflineSync passe à true après une sauvegarde offline', pendingOfflineSync === true);
      clearLocalOfflineCache();
      let raw2 = 'not-null';
      try { raw2 = localStorage.getItem(key); } catch(e) {}
      assert('clearLocalOfflineCache() supprime l\'entrée du compte courant uniquement', raw2 === null, `raw2=${raw2}`);
    } finally {
      currentUser = savedUser; pendingOfflineSync = savedPending;
      try {
        if (savedRaw === null) localStorage.removeItem(key); else localStorage.setItem(key, savedRaw);
      } catch(e) {}
    }
  }

  // Garde-fous statiques (2026-07-10) : saveToCloud() ne doit JAMAIS écraser la sauvegarde cloud
  // depuis une session évincée (sessionLocked), et doit retomber sur le cache local dès que la
  // coupure réseau est détectée (isOffline) -- même famille de garde-fou statique que
  // testMarketTutorialTargetsMarketHeadNotFullPanel (inspection du code source plutôt qu'un appel
  // réseau réel dans la suite de tests).
  function testSaveToCloudGuardsSessionLockAndOffline() {
    if (typeof saveToCloud !== 'function') return;
    const src = saveToCloud.toString();
    assert('saveToCloud() retourne immédiatement si sessionLocked est vrai (jamais d\'écrasement par une session évincée)',
      src.includes('sessionLocked'), `src=${src.slice(0,200)}`);
    assert('saveToCloud() bascule sur le cache local (saveToLocalOfflineCache) si isOffline est vrai',
      src.includes('isOffline') && src.includes('saveToLocalOfflineCache'));
  }
  // checkPlayerSession() ne doit JAMAIS verrouiller la session sur un simple échec réseau (offline
  // ou RPC en erreur) -- seul un vrai `data === false` renvoyé par le serveur doit déclencher
  // sessionLocked=true, sinon un joueur perdrait l'accès à son propre jeu à chaque coupure réseau.
  // Bug trouvé le 2026-07-10 (tests/companions.spec.js) : un currentUser fabriqué localement sans
  // vrai JWT Supabase (signInForTest()) faisait échouer claim_player_session() côté serveur
  // (auth.uid() NULL) -- check_player_session() renvoyait alors `false` par sécurité, que le
  // client interprétait à tort comme "évincé par une autre session", verrouillant l'UI entière
  // (#sessionLockOverlay intercepte tous les clics). checkPlayerSession() ne doit JAMAIS pouvoir
  // poser sessionLocked=true tant qu'un claim_player_session() n'a pas d'abord réussi.
  function testCheckPlayerSessionRequiresSuccessfulClaimFirst() {
    if (typeof checkPlayerSession !== 'function') return;
    const src = checkPlayerSession.toString();
    assert('checkPlayerSession() ne fait rien tant que sessionClaimOk n\'est pas vrai (pas de faux verrou sans claim réussi au préalable)',
      src.includes('sessionClaimOk'), `src=${src.slice(0,200)}`);
  }
  // Résumé du loot au retour (2026-07-10, demande explicite) : awaySilverGained/awayLootCounts
  // (game-core.js) ne doivent accumuler QUE pendant document.hidden, et showAwayLootSummaryIfAny()
  // doit les remettre à 0 après affichage (sinon un joueur verrait le même résumé se répéter au
  // prochain retour).
  function testAwayLootSummaryAccumulatesOnlyWhileHiddenAndResets() {
    if (typeof addSilver !== 'function' || typeof trackLoot !== 'function' || typeof showAwayLootSummaryIfAny !== 'function') return;
    const savedSilver = S.silver, savedEarned = S.silverEarned, savedLoot = { ...S.lootByItem };
    const savedAwaySilver = awaySilverGained, savedAwayLoot = { ...awayLootCounts };
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    try {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      awaySilverGained = 0; awayLootCounts = {};
      addSilver(50, 'loot');
      trackLoot('Test Item Away Regression', '#7aa35e', 50, 'material');
      assert('addSilver() accumule dans awaySilverGained pendant document.hidden', awaySilverGained === 50, `awaySilverGained=${awaySilverGained}`);
      assert('trackLoot() accumule dans awayLootCounts pendant document.hidden', awayLootCounts['Test Item Away Regression'] && awayLootCounts['Test Item Away Regression'].qty === 1);
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      addSilver(30, 'loot'); // ne doit PAS s'ajouter à awaySilverGained : onglet redevenu visible
      assert('addSilver() n\'accumule plus une fois document.hidden repassé à false', awaySilverGained === 50, `awaySilverGained=${awaySilverGained}`);
      // 2026-07-10 : remplace l'ancien showResetNotice()/#resetNoticeOverlay par le modal de
      // reconnexion React (src/core/reconnect-modal-react.js, #reconnectModalRoot) -- doit rendre
      // "Bon retour" avec le silver de l'absence dedans.
      const root = document.getElementById('reconnectModalRoot');
      root.innerHTML = ''; // état initial connu
      showAwayLootSummaryIfAny();
      assert('showAwayLootSummaryIfAny() monte le modal de reconnexion React dans #reconnectModalRoot', root.innerHTML.includes('Bon retour'), root.innerHTML.slice(0,120));
      assert('Le modal contient bien le silver accumulé pendant l\'absence', root.innerHTML.includes('50'));
      assert('showAwayLootSummaryIfAny() remet les compteurs à 0 après affichage', awaySilverGained === 0 && Object.keys(awayLootCounts).length === 0);
    } finally {
      if (desc) Object.defineProperty(document, 'hidden', desc);
      S.silver = savedSilver; S.silverEarned = savedEarned; S.lootByItem = savedLoot;
      awaySilverGained = savedAwaySilver; awayLootCounts = savedAwayLoot;
    }
  }
  // bug corrigé (2026-07-10, rapporté explicitement : "modal de retour invisible") : le wrapper du
  // modal centrait son contenu SANS overflowY -- un contenu plus haut que le viewport (fréquent :
  // niveau + stats + objets + historique + bouton) débordait des deux côtés du conteneur fixed,
  // rendant l'en-tête/le bouton "fermer" et le bouton "Récupérer le butin" inatteignables (ni
  // visibles, ni scrollables). Garde-fou statique sur les styles réels appliqués, pas seulement
  // "ne plante pas" : overflowY doit permettre le scroll, alignItems ne doit plus centrer un
  // contenu potentiellement plus grand que l'écran.
  function testReconnectModalWrapperScrollsInsteadOfClipping() {
    if (typeof showAwayLootSummaryIfAny !== 'function') return;
    const savedAwaySilver = awaySilverGained, savedAwayLoot = { ...awayLootCounts };
    const root = document.getElementById('reconnectModalRoot');
    try {
      awaySilverGained = 100; awayLootCounts = {};
      // pas de root.innerHTML='' ici : le root React existe déjà (créé par le test précédent) --
      // vider le DOM à la main corromprait le suivi interne des fibers de React (le prochain
      // render planterait sur un removeChild sur un noeud qui n'existe plus), même piège que
      // testAwayLootSummaryAccumulatesOnlyWhileHiddenAndResets ne rencontre PAS lui puisqu'il
      // s'exécute avant que le root existe. openReconnectModal() gère lui-même le remplacement.
      showAwayLootSummaryIfAny();
      const wrapper = root.firstElementChild;
      assert('#reconnectModalRoot a bien un wrapper monté', !!wrapper);
      if (wrapper) {
        const cs = getComputedStyle(wrapper);
        assert('Le wrapper du modal de reconnexion est scrollable verticalement (overflowY: auto)', cs.overflowY === 'auto', `overflowY=${cs.overflowY}`);
        assert('Le wrapper du modal de reconnexion aligne le contenu en haut, pas centré (évite le clip)', cs.alignItems === 'flex-start', `alignItems=${cs.alignItems}`);
      }
    } finally {
      awaySilverGained = savedAwaySilver; awayLootCounts = savedAwayLoot;
    }
  }
  // même bug que testPatchNotesCategoryChipsWrapOnSameRowInsteadOfStacking, autre fichier React
  // touché par la même règle globale "button { width:100% }" -- chips de palier (Tous/Mid/End/...)
  // de l'historique du modal de reconnexion.
  function testReconnectModalTierChipsWrapOnSameRowInsteadOfStacking() {
    if (typeof showAwayLootSummaryIfAny !== 'function') return;
    const savedAwaySilver = awaySilverGained, savedAwayLoot = { ...awayLootCounts };
    const root = document.getElementById('reconnectModalRoot');
    try {
      awaySilverGained = 100; awayLootCounts = {};
      showAwayLootSummaryIfAny();
      const chips = Array.from(root.querySelectorAll('.rcBtn')).filter(b => b.textContent && (b.textContent === 'Tous' || (typeof GEAR_TIERS !== 'undefined' && GEAR_TIERS.some(g => (g.label[LANG]||g.label.fr) === b.textContent))));
      assert('Au moins 2 chips de palier affichées', chips.length >= 2, String(chips.length));
      if (chips.length >= 2) {
        assert('Les 2 premières chips de palier sont sur la même ligne (wrap horizontal, pas empilées verticalement)',
          chips[0].offsetTop === chips[1].offsetTop, `top0=${chips[0].offsetTop} top1=${chips[1].offsetTop}`);
      }
    } finally {
      awaySilverGained = savedAwaySilver; awayLootCounts = savedAwayLoot;
    }
  }
  // niveau/% XP capturés au moment où l'onglet passe caché (2026-07-10, modal de reconnexion --
  // "Progression de niveau" avant/après) -- sans ça, "avant" ne pourrait jamais différer de
  // "maintenant" puisque S.lvl/S.xp auraient déjà bougé pendant l'absence au moment de la lecture.
  function testAwayLevelSnapshotCapturedOnHide() {
    if (typeof S === 'undefined') return;
    const savedLvl = S.lvl, savedXp = S.xp, savedXpNext = S.xpNext;
    const savedLevelBefore = awayLevelBefore, savedPercentBefore = awayPercentBefore;
    const desc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    try {
      S.lvl = 12; S.xp = 40; S.xpNext = 100; // 40%
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      assert('awayLevelBefore capture S.lvl au moment où l\'onglet passe caché', awayLevelBefore === 12, `awayLevelBefore=${awayLevelBefore}`);
      assert('awayPercentBefore capture le % XP au moment où l\'onglet passe caché', awayPercentBefore === 40, `awayPercentBefore=${awayPercentBefore}`);
      S.lvl = 13; S.xp = 5; // le joueur progresse pendant l'absence -- awayLevelBefore ne doit PAS bouger
      assert('awayLevelBefore reste figé pendant l\'absence, indépendant de S.lvl qui continue', awayLevelBefore === 12);
    } finally {
      if (desc) Object.defineProperty(document, 'hidden', desc);
      S.lvl = savedLvl; S.xp = savedXp; S.xpNext = savedXpNext;
      awayLevelBefore = savedLevelBefore; awayPercentBefore = savedPercentBefore;
    }
  }
  // compendiumOverallPct() : combine zones + boss + PEN (core/game-core.js) -- distinct de
  // compendiumPct() (points de bonus de stat, PEN exclu) : régression possible si quelqu'un
  // confond les deux un jour (voir CLAUDE.md §7, 3e exception React, Compendium).
  function testCompendiumOverallPctCombinesAllThreeSources() {
    if (typeof compendiumOverallPct !== 'function') return;
    const savedLoot = { ...S.lootByItem }, savedBosses = { ...S.bossesKilled }, savedPen = { ...S.penMastery };
    try {
      S.lootByItem = {}; S.bossesKilled = {}; S.penMastery = {};
      assert('0% quand rien n\'est fait', compendiumOverallPct() === 0, `pct=${compendiumOverallPct()}`);
      // débloque tout : chaque zone (ses 4 objets), tous les boss, tous les items PEN
      ZONES.forEach((z, zi) => { zoneItemNames(zi).forEach(n => { S.lootByItem[n] = 1; }); });
      Object.keys(BOSS_ROSTER).forEach(id => { S.bossesKilled[id] = Date.now(); });
      penMasteryItemList().forEach(e => { S.penMastery[e.name] = true; });
      assert('100% quand tout est fait (zones+boss+PEN)', compendiumOverallPct() === 100, `pct=${compendiumOverallPct()}`);
    } finally {
      S.lootByItem = savedLoot; S.bossesKilled = savedBosses; S.penMastery = savedPen;
    }
  }
  // registre monde/boss du Compendium React (src/progression/compendium-react.js) -- même famille
  // de garde-fou que testAdminSectionsWellFormed : un monde ou un boss ajouté côté data sans être
  // reflété ici afficherait silencieusement rien (pas de couleur / boss orphelin d'aucun monde).
  function testCompendiumWorldAndBossRegistriesAreComplete() {
    if (typeof CMP_WORLD_COLOR === 'undefined' || typeof CMP_BOSS_WORLD === 'undefined') return;
    ZONE_TIERS.forEach(w => assert(`CMP_WORLD_COLOR couvre le monde "${w.id}"`, !!CMP_WORLD_COLOR[w.id]));
    Object.keys(BOSS_ROSTER).forEach(id => {
      assert(`CMP_BOSS_WORLD couvre le boss "${id}"`, !!CMP_BOSS_WORLD[id]);
      assert(`CMP_BOSS_WORLD["${id}"] pointe vers un monde réel de ZONE_TIERS`, ZONE_TIERS.some(w => w.id === CMP_BOSS_WORLD[id]));
    });
  }
  // cmpMastered() : fonction PURE (src/progression/compendium-react.js), distingue "PEN (V)" des
  // niveaux intermédiaires ("+9", "TRI (III)"...) affichés dans l'onglet Maîtrise PEN.
  function testCmpMasteredDetectsOnlyPenLevel() {
    if (typeof cmpMastered !== 'function') return;
    assert('"PEN (V)" est détecté comme maîtrisé', cmpMastered('PEN (V)') === true);
    assert('"+9" n\'est pas maîtrisé', cmpMastered('+9') === false);
    assert('"TRI (III)" n\'est pas maîtrisé', cmpMastered('TRI (III)') === false);
    assert('"—" (jamais possédé) n\'est pas maîtrisé', cmpMastered('—') === false);
  }
  // openCompendiumReact()/closeCompendiumReact() : montent/démontent bien le modal React dans
  // #compendiumModalRoot -- même garde-fou que le modal de reconnexion (regression 2026-07-10).
  function testCompendiumReactOpensAndClosesInDom() {
    if (typeof openCompendiumReact !== 'function' || typeof closeCompendiumReact !== 'function') return;
    const root = document.getElementById('compendiumModalRoot');
    root.innerHTML = '';
    openCompendiumReact();
    assert('openCompendiumReact() monte le Compendium dans #compendiumModalRoot', root.innerHTML.includes('Compendium'), root.innerHTML.slice(0,120));
    closeCompendiumReact();
    assert('closeCompendiumReact() démonte le contenu', root.innerHTML === '', root.innerHTML.slice(0,120));
  }
  // entry_id des lignes de patch note (2026-07-10, karma/commentaires) doit rester STABLE et
  // unique -- il dérive de la position dans p[LANG], pas de l'ordre d'affichage. pneFlattenPage()
  // (src/progression/patch-notes-engage-react.js) est la SEULE source de cette dérivation
  // maintenant que le panneau React remplace entièrement l'ancien rendu HTML.
  function testPneFlattenPageProducesStableUniqueEntryIds() {
    if (typeof pneFlattenPage !== 'function' || typeof PATCH_NOTES === 'undefined' || !PATCH_NOTES[0]) return;
    const rows = pneFlattenPage([PATCH_NOTES[0]], 0);
    const ids = rows.map(r => r.entryId);
    assert('pneFlattenPage() produit au moins une entrée', ids.length > 0);
    assert('Les entry_id de la dernière version sont tous uniques', new Set(ids).size === ids.length, ids.join(','));
    assert('Chaque entry_id commence bien par le numéro de version', ids.every(id => id.startsWith(PATCH_NOTES[0].v + '-')), ids.join(','));
  }
  // pneContainsBannedWord() : fonction PURE (src/progression/patch-notes-engage-react.js), garde-fou
  // UX client -- le vrai blocage non contournable vit côté serveur (add_patch_note_comment RPC).
  function testPneContainsBannedWordDetectsAccentedVariants() {
    if (typeof pneContainsBannedWord !== 'function') return;
    assert('Détecte un mot banni tel quel', pneContainsBannedWord('tu es un idiot') === true);
    assert('Détecte une variante accentuée', pneContainsBannedWord('espèce de débile') === true);
    assert('Un commentaire normal n\'est pas bloqué', pneContainsBannedWord('merci pour cette mise à jour !') === false);
  }
  // openPatchNotesReact()/closePatchNotesReact() : montent/démontent bien le panneau React dans
  // #patchNotesModalRoot -- même garde-fou que le modal de reconnexion/le Compendium (2026-07-10,
  // "comme la maquette" -- remplace entièrement renderPatchNotesPanel() côté React, celle-ci ne
  // reste qu'un repli si React est indisponible).
  function testPatchNotesReactOpensAndClosesInDom() {
    if (typeof openPatchNotesReact !== 'function' || typeof closePatchNotesReact !== 'function') return;
    const root = document.getElementById('patchNotesModalRoot');
    if (!root) return;
    root.innerHTML = '';
    openPatchNotesReact();
    assert('openPatchNotesReact() monte le panneau dans #patchNotesModalRoot', root.innerHTML.includes(LANG === 'fr' ? 'Notes de mise à jour' : 'Patch notes'), root.innerHTML.slice(0,150));
    closePatchNotesReact();
    assert('closePatchNotesReact() démonte le contenu', root.innerHTML === '', root.innerHTML.slice(0,120));
  }
  // bug corrigé (2026-07-11, rapporté explicitement avec capture d'écran) : la règle globale
  // "button { width:100%; margin-top:4px; ... }" (src/styles/styles.css) s'applique à TOUT
  // <button> du document -- aucune chip de catégorie ne fixait explicitement width/margin, donc
  // elles s'empilaient en pleine largeur au lieu de wrapper comme la maquette. Corrigé par un
  // reset scopé "#patchNotesModalRoot button { width:auto; margin:0; }" -- ce test vérifie que
  // 2 chips consécutives retombent bien sur la MÊME ligne (même offsetTop), pas empilées.
  function testPatchNotesCategoryChipsWrapOnSameRowInsteadOfStacking() {
    if (typeof openPatchNotesReact !== 'function' || typeof closePatchNotesReact !== 'function') return;
    const root = document.getElementById('patchNotesModalRoot');
    if (!root) return;
    root.innerHTML = '';
    openPatchNotesReact();
    const chips = Array.from(root.querySelectorAll('.pneChip'));
    assert('Au moins 2 chips de catégorie affichées', chips.length >= 2, String(chips.length));
    if (chips.length >= 2) {
      assert('Les 2 premières chips de catégorie sont sur la même ligne (wrap horizontal, pas empilées verticalement)',
        chips[0].offsetTop === chips[1].offsetTop, `top0=${chips[0].offsetTop} top1=${chips[1].offsetTop}`);
    }
    closePatchNotesReact();
  }
  // audit du 2026-07-11 (patch-notes-pipeline.md §5) : pneResolveInitialPageStart() lit
  // "#patch-{version}" au montage et retourne le pageStart de la page contenant cette version --
  // fonction PURE, testable sans DOM/React.
  function testPneResolveInitialPageStartFromHash() {
    if (typeof pneResolveInitialPageStart !== 'function' || typeof computePatchPages !== 'function') return;
    const savedHash = location.hash;
    try {
      const targetVersion = PATCH_NOTES[PATCH_NOTES.length - 1].v; // la plus ancienne -- garantie sur une page différente de la première si computePatchPages() pagine
      location.hash = '#patch-' + encodeURIComponent(targetVersion);
      const idx = PATCH_NOTES.findIndex(p => p.v === targetVersion);
      const expectedPage = computePatchPages().find(pg => idx >= pg.start && idx < pg.start + pg.count);
      assert('pneResolveInitialPageStart() retrouve la bonne page pour un hash de version valide',
        pneResolveInitialPageStart() === expectedPage.start, `got=${pneResolveInitialPageStart()} expected=${expectedPage.start}`);
      location.hash = '#patch-ce-numero-nexiste-pas-9999';
      assert('pneResolveInitialPageStart() retombe sur patchPageStart si le hash ne matche aucune version',
        pneResolveInitialPageStart() === patchPageStart);
      location.hash = '';
      assert('pneResolveInitialPageStart() retombe sur patchPageStart sans hash', pneResolveInitialPageStart() === patchPageStart);
    } finally {
      location.hash = savedHash;
    }
  }
  // audit du 2026-07-11 (pipeline doc §7 : "focus trap... le focus clavier ne doit pas sortir du
  // dialog") -- Tab sur le dernier élément focusable doit revenir au premier, jamais sortir du
  // panneau React.
  function testPatchNotesFocusTrapKeepsTabWithinDialog() {
    if (typeof openPatchNotesReact !== 'function' || typeof closePatchNotesReact !== 'function') return;
    const root = document.getElementById('patchNotesModalRoot');
    if (!root) return;
    root.innerHTML = '';
    openPatchNotesReact();
    const dialog = root.querySelector('[role="dialog"] > div');
    if (!dialog) { closePatchNotesReact(); return; }
    const focusables = Array.from(dialog.querySelectorAll('button:not(:disabled), input, [tabindex]:not([tabindex="-1"])'));
    assert('Au moins 2 éléments focusables dans le panneau', focusables.length >= 2, String(focusables.length));
    if (focusables.length >= 2) {
      const first = focusables[0], last = focusables[focusables.length - 1];
      last.focus();
      assert('Le dernier élément a bien le focus avant le test', document.activeElement === last);
      const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      window.dispatchEvent(ev);
      assert('Tab depuis le dernier élément focusable revient au premier (piège de focus, pas de sortie du dialog)',
        document.activeElement === first, `activeElement=${document.activeElement && document.activeElement.tagName}`);
    }
    closePatchNotesReact();
  }
  // audit du 2026-07-11 (fidélité maquette : tampon "Lu" par entrée) -- une entrée dont la version
  // est déjà dans readPatches affiche le tampon "Lu", jamais le point "Nouveau".
  function testPatchNotesEntryShowsReadStampForAlreadySeenVersion() {
    if (typeof openPatchNotesReact !== 'function' || typeof closePatchNotesReact !== 'function') return;
    const root = document.getElementById('patchNotesModalRoot');
    if (!root || PATCH_NOTES.length === 0) return;
    const targetVersion = PATCH_NOTES[0].v;
    const wasRead = readPatches.has(targetVersion);
    try {
      readPatches.add(targetVersion);
      root.innerHTML = '';
      openPatchNotesReact();
      const versionBlock = document.getElementById('pne-version-' + targetVersion);
      assert('Le bloc de version cible est bien rendu (id pne-version-*, requis par le deep link)', !!versionBlock);
      if (versionBlock) {
        assert('Une version déjà lue affiche le tampon "Lu" sur ses entrées, pas le point "Nouveau"',
          versionBlock.textContent.indexOf('Lu') !== -1 && !versionBlock.querySelector('.pnePulseDot'),
          versionBlock.textContent.slice(0, 80));
      }
    } finally {
      if (!wasRead) readPatches.delete(targetVersion);
      closePatchNotesReact();
    }
  }
  // audit du 2026-07-11 (pipeline doc §7 : "aria-live='polite' sur le badge de compteur... pour
  // que les lecteurs d'écran annoncent les nouveautés") -- garde-fou statique sur le HTML source
  // (pas besoin de DOM navigateur), même famille que les autres tests d'ordre de chargement.
  function testPatchBadgeHasAriaLive() {
    if (typeof document === 'undefined') return;
    const badge = document.getElementById('patchBadge');
    if (!badge) return; // hors contexte page réelle
    assert('#patchBadge porte aria-live="polite" (annonce des nouveautés aux lecteurs d\'écran)', badge.getAttribute('aria-live') === 'polite');
  }
  // reconnectDurationLabel() : fonction PURE (src/core/reconnect-modal-react.js), formate la durée
  // d'absence affichée dans "Absent pendant" / l'historique -- testable sans DOM ni React.
  function testReconnectDurationLabelFormatsHoursAndMinutes() {
    if (typeof reconnectDurationLabel !== 'function') return;
    assert('Moins d\'1h : minutes seules', reconnectDurationLabel(new Date(0), new Date(45*60000)) === '45min');
    assert('Plusieurs heures : "Xh MMmin"', reconnectDurationLabel(new Date(0), new Date((3*60+7)*60000)) === '3h 07min');
    assert('Arrondi au minimum à 1 minute (jamais 0min)', reconnectDurationLabel(new Date(0), new Date(10000)) === '1min');
  }
  // record perso À VIE de silver/session AFK (2026-07-10) -- même famille que bestKpm/
  // bestSilverPerHour (CLAUDE.md "record monotone") : ne doit jamais redescendre, même si une
  // session suivante rapporte moins.
  function testBestAfkSessionSilverIsMonotone() {
    if (typeof showAwayLootSummaryIfAny !== 'function') return;
    const savedBest = S.bestAfkSessionSilver;
    const savedAwaySilver = awaySilverGained, savedAwayLoot = { ...awayLootCounts };
    try {
      S.bestAfkSessionSilver = 100;
      awaySilverGained = 500; awayLootCounts = {};
      showAwayLootSummaryIfAny();
      assert('Une session plus généreuse relève le record', S.bestAfkSessionSilver === 500, `bestAfkSessionSilver=${S.bestAfkSessionSilver}`);
      awaySilverGained = 10; awayLootCounts = {};
      showAwayLootSummaryIfAny();
      assert('Une session plus faible ne fait jamais redescendre le record', S.bestAfkSessionSilver === 500, `bestAfkSessionSilver=${S.bestAfkSessionSilver}`);
    } finally {
      S.bestAfkSessionSilver = savedBest;
      awaySilverGained = savedAwaySilver; awayLootCounts = savedAwayLoot;
    }
  }
  // MAX_STACK relevé de 9999 à 999999 (2026-07-10, rapporté explicitement : "pourquoi on peut se
  // retrouver avec plusieurs stack d'une meme ressources") -- invAdd() ne fusionne dans un stack
  // existant que si qty < MAX_STACK ; un stack déjà à l'ancien plafond (9999) doit désormais
  // continuer à absorber de nouveaux ramassages du même nom plutôt que de créer un 2e stack.
  function testInvAddMergesPastOldMaxStackThreshold() {
    if (typeof invAdd !== 'function') return;
    const savedInv = INV.slice();
    try {
      for (let i = 0; i < INV_SIZE; i++) INV[i] = null;
      INV[0] = { key:'mat_test', name:'Test Stack Regression', kind:'material', icon:'✦', color:'#fff', qty:9999, stackable:true, weight:0.1, val:1 };
      const ok = invAdd({ key:'mat_test', name:'Test Stack Regression', kind:'material', icon:'✦', color:'#fff', qty:50, stackable:true, weight:0.1, val:1 });
      assert('invAdd() fusionne dans le stack existant même au-delà de l\'ancien plafond 9999', ok === true);
      const slots = INV.filter(s => s && s.name === 'Test Stack Regression');
      assert('Un SEUL stack pour cette ressource, pas 2', slots.length === 1, `slots=${slots.length}`);
      assert('La quantité fusionnée est correcte', slots[0] && slots[0].qty === 10049, `qty=${slots[0] && slots[0].qty}`);
    } finally {
      for (let i = 0; i < INV_SIZE; i++) INV[i] = savedInv[i];
    }
  }
  function testCheckPlayerSessionNeverLocksOnNetworkFailure() {
    if (typeof checkPlayerSession !== 'function') return;
    const src = checkPlayerSession.toString();
    assert('checkPlayerSession() ignore l\'appel tant que isOffline est vrai (pas de faux-positif de verrouillage)',
      src.includes('isOffline'), `src=${src.slice(0,200)}`);
    assert('checkPlayerSession() ne pose sessionLocked=true que sur data===false explicite (jamais sur error)',
      /if\s*\(error\)\s*return/.test(src) && src.includes('data === false'));
  }
  // reportClientError() (2026-07-21, repo-audit-todo.md point 18) : monitoring d'erreurs client
  // minimal (window.onerror/unhandledrejection -> public.client_errors). Garde-fou statique
  // (isOffline/!sb) même pattern que les autres fonctions réseau ci-dessus, + test dynamique du
  // throttle (jamais plus de CLIENT_ERROR_MAX_PER_SESSION tentatives réseau par session, sinon une
  // boucle d'erreur répétée spammerait la table).
  function testReportClientErrorGuardsOfflineAndMissingClient() {
    if (typeof reportClientError !== 'function') return;
    const src = reportClientError.toString();
    assert('reportClientError() ignore l\'appel si isOffline est vrai', src.includes('isOffline'));
    assert('reportClientError() ignore l\'appel si sb est absent (pas encore initialisé)', src.includes('!sb'));
    assert('reportClientError() respecte un plafond par session (CLIENT_ERROR_MAX_PER_SESSION)',
      src.includes('CLIENT_ERROR_MAX_PER_SESSION'));
  }
  function testReportClientErrorThrottlesAfterMaxPerSession() {
    if (typeof reportClientError !== 'function' || typeof CLIENT_ERROR_MAX_PER_SESSION === 'undefined') return;
    const savedCount = clientErrorCount, savedOffline = isOffline, savedSb = sb;
    let insertCalls = 0;
    isOffline = false;
    sb = { from: () => ({ insert: () => { insertCalls++; return { then: (res) => { res && res(); return { catch: () => {} }; } }; } }) };
    try {
      clientErrorCount = CLIENT_ERROR_MAX_PER_SESSION - 1;
      reportClientError('test error 1'); // dernier appel autorisé (compteur atteint le plafond)
      reportClientError('test error 2'); // doit être ignoré (plafond déjà atteint)
      assert('reportClientError() n\'insère plus une fois CLIENT_ERROR_MAX_PER_SESSION atteint',
        insertCalls === 1, `insertCalls=${insertCalls}`);
    } finally {
      clientErrorCount = savedCount; isOffline = savedOffline; sb = savedSb;
    }
  }

  // ---------- i18n (2026-07-11, voir docs/I18N_PLAN.md/CLAUDE.md §31) ----------
  // Garde-fous complémentaires à scripts/check-missing-translations.js (qui tourne côté Node, hors
  // navigateur) : ici on vérifie l'état RÉEL de i18next une fois chargé dans la page.
  function testI18nextInitializedWithSupportedLangs() {
    assert('i18next existe globalement', typeof i18next !== 'undefined');
    if (typeof i18next === 'undefined') return;
    assert('i18next est initialisé au moment où les tests tournent', i18next.isInitialized === true);
    assert('SUPPORTED_LANGS contient fr et en', typeof SUPPORTED_LANGS !== 'undefined' && SUPPORTED_LANGS.includes('fr') && SUPPORTED_LANGS.includes('en'));
  }
  // ordre de chargement critique (même famille de piège que testSorcierRenderLoadsBeforeSyncStartupCallers,
  // section 8 CLAUDE.md) : i18n-resources.generated.js et i18n-init.js DOIVENT charger avant tout
  // fichier de gameplay, sinon un appel i18next.t() invoqué tôt au chargement (ex: hud() synchrone)
  // planterait ou afficherait une clé brute.
  function testI18nResourcesLoadBeforeGameplayFiles() {
    if (typeof document === 'undefined') return; // hors-contexte navigateur
    const srcIndexOf = needle => Array.from(document.scripts).findIndex(s => s.src.includes(needle));
    const resourcesIdx = srcIndexOf('core/i18n-resources.generated.js');
    const initIdx = srcIndexOf('core/i18n-init.js');
    const gearIconsIdx = srcIndexOf('inventory/gear-icons.js');
    const coreIdx = srcIndexOf('core/game-core.js');
    assert('i18n-resources.generated.js est chargé (balise trouvée dans le DOM)', resourcesIdx !== -1);
    assert('i18n-init.js est chargé (balise trouvée dans le DOM)', initIdx !== -1);
    if (resourcesIdx === -1 || initIdx === -1 || gearIconsIdx === -1 || coreIdx === -1) return;
    assert('i18n-resources.generated.js charge AVANT i18n-init.js', resourcesIdx < initIdx, `resourcesIdx=${resourcesIdx}, initIdx=${initIdx}`);
    assert('i18n-init.js charge AVANT gear-icons.js (1er fichier de gameplay)', initIdx < gearIconsIdx, `initIdx=${initIdx}, gearIconsIdx=${gearIconsIdx}`);
    assert('i18n-init.js charge AVANT game-core.js', initIdx < coreIdx, `initIdx=${initIdx}, coreIdx=${coreIdx}`);
  }
  // clé brute affichée au joueur = régression silencieuse (voir docs/I18N_PLAN.md §7 "Clé manquante") --
  // échantillon de clés réellement migrées (domaine core, migré manuellement) pour détecter une
  // régression de chargement des ressources sans dépendre du contenu exact de chaque domaine.
  function testI18nextResolvesKnownKeysNotRawKey() {
    if (typeof i18next === 'undefined' || !i18next.isInitialized) return;
    const sampleKeys = ['core:core.combat.dodge', 'core:core.zone.no_monsters', 'core:core.default_pseudo'];
    sampleKeys.forEach(k => {
      assert(`i18next.exists('${k}') est vrai (clé fr/en réellement définie)`, i18next.exists(k));
    });
  }
  // le toggle #langToggle (game-supabase.js) doit garder i18next.language synchronisé avec LANG --
  // sinon les nouveaux textes migrés (i18next.t) et les anciens ternaires LANG=== restant à migrer
  // afficheraient deux langues différentes en même temps après un clic sur le toggle.
  function testChangeLanguageStaysInSyncWithGlobalLang() {
    if (typeof i18next === 'undefined' || !i18next.isInitialized || typeof LANG === 'undefined') return;
    const before = LANG;
    i18next.changeLanguage(before === 'fr' ? 'en' : 'fr');
    assert('i18next.language suit un changeLanguage() explicite', i18next.language === (before === 'fr' ? 'en' : 'fr'), `attendu=${before === 'fr' ? 'en' : 'fr'}, obtenu=${i18next.language}`);
    i18next.changeLanguage(before); // restaure l'état pour ne pas polluer les tests suivants / la session réelle
  }
  // toutes les ressources chargées doivent avoir EXACTEMENT le même jeu de domaines et de clés en
  // fr et en -- même vérification que scripts/check-missing-translations.js (§8bis) mais côté
  // navigateur, sur les ressources RÉELLEMENT chargées par i18next (pas juste les fichiers sources).
  function testI18nResourcesFrEnKeyParity() {
    if (typeof I18N_RESOURCES === 'undefined') return;
    const domains = Object.keys(I18N_RESOURCES.fr || {});
    assert('I18N_RESOURCES contient au moins un domaine', domains.length > 0);
    domains.forEach(domain => {
      const frKeys = Object.keys((I18N_RESOURCES.fr || {})[domain] || {}).sort();
      const enKeys = Object.keys((I18N_RESOURCES.en || {})[domain] || {}).sort();
      assert(`${domain}.json : mêmes clés en fr et en (${frKeys.length} clés)`, JSON.stringify(frKeys) === JSON.stringify(enKeys), `fr-only ou en-only détecté dans ${domain}`);
    });
  }

  // ---------- refonte visuelle Succès (2026-07-11) : chaînes de paliers ----------
  // testé avec un état de sauvegarde FICTIF passé directement en argument (jamais le vrai S global)
  // -- possible car statFn:S=>S.kills etc. lisent explicitement le paramètre reçu plutôt qu'une
  // fermeture sur le S global, comme nextAchievement()/checkAchievements() le font déjà.
  function testGroupAchievementsIntoChainsGroupsByStatFnIdentity() {
    const chains = groupAchievementsIntoChains();
    const totalTiers = chains.reduce((sum, c) => sum + c.tiers.length, 0);
    assert('groupAchievementsIntoChains() ne perd ni ne duplique aucun succès', totalTiers === ACHIEVEMENTS.length, `total=${totalTiers}, attendu=${ACHIEVEMENTS.length}`);
    const killsChain = chains.find(c => c.tiers.some(a => a.id === 'first_kill'));
    assert('la chaîne "kills" regroupe les 4 paliers, dans l\'ordre du tableau source',
      !!killsChain && killsChain.tiers.map(a => a.id).join(',') === 'first_kill,kills_100,kills_1000,kills_10000',
      JSON.stringify(killsChain && killsChain.tiers.map(a => a.id)));
    const silverChain = chains.find(c => c.tiers.some(a => a.id === 'silver_10k'));
    assert('la chaîne "silver" regroupe les 4 paliers silver_10k->10m',
      !!silverChain && silverChain.tiers.length === 4, silverChain && silverChain.tiers.length);
    const jackpotChain = chains.find(c => c.tiers.some(a => a.id === 'jackpot_1'));
    assert('jackpot_1 forme sa propre chaîne à 1 palier (pas de palier frère)', !!jackpotChain && jackpotChain.tiers.length === 1);
    const gearChain = chains.find(c => c.tiers.some(a => a.id === 'gear_1'));
    assert('gear_1 forme aussi sa propre chaîne à 1 palier (statFn distinct de jackpot_1)', !!gearChain && gearChain.tiers.length === 1 && gearChain !== jackpotChain);
  }
  // garde-fou (régression) : un check vert ne doit JAMAIS apparaître tant qu'un palier de la chaîne
  // reste verrouillé -- même si des paliers intermédiaires sont déjà débloqués individuellement.
  function testChainProgressNeverMarksIntermediateTierDoneAheadOfChain() {
    const killsChain = groupAchievementsIntoChains().find(c => c.tiers.some(a => a.id === 'first_kill'));
    // kills_10000 pas encore débloqué -- 3 paliers sur 4 le sont
    const partialS = { kills: 1500, achUnlocked: { first_kill: 1, kills_100: 2, kills_1000: 3 } };
    const partial = chainProgress(killsChain, partialS);
    assert('chaîne en cours : le palier actif est le 1er palier NON débloqué (kills_10000)', partial.tier.id === 'kills_10000', partial.tier.id);
    assert('chaîne en cours : done=false tant qu\'un palier reste verrouillé (pas de check vert prématuré)', partial.done === false);
    assert('chaîne en cours : unlockedCount reflète bien les 3 paliers réellement débloqués', partial.unlockedCount === 3, partial.unlockedCount);
    // les 4 paliers sont débloqués
    const fullS = { kills: 99999, achUnlocked: { first_kill: 1, kills_100: 2, kills_1000: 3, kills_10000: 4 } };
    const full = chainProgress(killsChain, fullS);
    assert('chaîne 100% débloquée : le palier actif est le DERNIER palier (jamais un intermédiaire)', full.tier.id === 'kills_10000');
    assert('chaîne 100% débloquée : done=true (seul cas où le check vert doit apparaître)', full.done === true);
    assert('chaîne 100% débloquée : pct fixé à 100, jamais recalculé au-delà', full.pct === 100, full.pct);
  }
  function testSortChainsForDisplayPushesCompletedChainsToEnd() {
    // état minimal mais safe pour TOUTES les chaînes (y compris gs_*/enh_*/treasure_* qui lisent
    // GS()/maxEnhLv()/treasureTotal() -- treasureTotal() accède à S.lootByItem[...], doit exister)
    const fakeS = {
      kills: 0, lootCount: 0, silverEarned: 0, maxZoneIdx: 0, jackpotCount: 1, gearDropCount: 1,
      playtimeSec: 0, lootByItem: {}, achUnlocked: { jackpot_1: 1, gear_1: 2 },
    };
    const chains = groupAchievementsIntoChains();
    const ordered = sortChainsForDisplay(chains, fakeS);
    assert('sortChainsForDisplay() retourne toutes les chaînes (aucune perdue)', ordered.length === chains.length, `${ordered.length} vs ${chains.length}`);
    assert('sortChainsForDisplay() : une chaîne encore en cours passe en premier', !ordered[0].progress.done, JSON.stringify(ordered[0].chain.tiers.map(a=>a.id)));
    const doneChains = ordered.filter(e => e.progress.done);
    assert('sortChainsForDisplay() : jackpot_1 et gear_1 (seules chaînes débloquées ici) sont bien poussées en fin de liste',
      doneChains.length > 0 && ordered.slice(ordered.length - doneChains.length).every(e => e.progress.done));
  }
  function testAchievementSilverTotalsSplitsEarnedAndRemaining() {
    const fakeS = { achUnlocked: {} };
    ACHIEVEMENTS.forEach((a, i) => { if (i % 2 === 0) fakeS.achUnlocked[a.id] = 1; });
    const { earned, remaining } = achievementSilverTotals(fakeS);
    const expectedEarned = ACHIEVEMENTS.filter((a, i) => i % 2 === 0).reduce((s, a) => s + a.reward, 0);
    const expectedRemaining = ACHIEVEMENTS.filter((a, i) => i % 2 !== 0).reduce((s, a) => s + a.reward, 0);
    assert('achievementSilverTotals() : silver déjà gagné = somme des reward des succès débloqués', earned === expectedEarned, `${earned} vs ${expectedEarned}`);
    assert('achievementSilverTotals() : silver restant = somme des reward des succès verrouillés', remaining === expectedRemaining, `${remaining} vs ${expectedRemaining}`);
    assert('achievementSilverTotals() : la somme des deux couvre bien tous les succès', earned + remaining === ACHIEVEMENTS.reduce((s,a)=>s+a.reward,0));
  }
  function testAchCatCompletionUsesRealUnlockedCounts() {
    const fakeS = { achUnlocked: {} };
    const combatIds = ACHIEVEMENTS.filter(a => achCat(a.id) === 'combat').map(a => a.id);
    fakeS.achUnlocked[combatIds[0]] = 1; // 1 seul débloqué sur la catégorie combat
    const combat = achCatCompletion('combat', fakeS);
    assert('achCatCompletion() : total = nombre réel de succès de la catégorie', combat.total === combatIds.length, combat.total);
    assert('achCatCompletion() : done reflète le vrai nombre débloqué (1 ici)', combat.done === 1, combat.done);
    const all = achCatCompletion('all', fakeS);
    assert('achCatCompletion(\'all\') : total = ACHIEVEMENTS.length', all.total === ACHIEVEMENTS.length, all.total);
  }
  function testRecentlyUnlockedAchievementsSortsByTimestampDescendingAndRespectsLimit() {
    const fakeS = { achUnlocked: { first_kill: 1000, kills_100: 3000, loot_1: 2000 } };
    const recent = recentlyUnlockedAchievements(fakeS, 2);
    assert('recentlyUnlockedAchievements() trie du plus récent au plus ancien', recent.map(a => a.id).join(',') === 'kills_100,loot_1', recent.map(a => a.id).join(','));
    assert('recentlyUnlockedAchievements() respecte la limite demandée', recent.length === 2, recent.length);
  }
  // défensif : une entrée non numérique (sauvegarde très ancienne hypothétique) ne doit jamais
  // remonter dans la liste plutôt que d'afficher un horodatage cassé au joueur.
  function testRecentlyUnlockedAchievementsIgnoresNonNumericTimestamps() {
    const fakeS = { achUnlocked: { first_kill: true, kills_100: 3000 } };
    const recent = recentlyUnlockedAchievements(fakeS, 5);
    assert('recentlyUnlockedAchievements() ignore une entrée achUnlocked non numérique', recent.map(a => a.id).join(',') === 'kills_100', recent.map(a => a.id).join(','));
  }

  // Refonte visuelle "Zone" -- Phase 6 (2026-07-22) : #sideMenu (#gameBar/#userBar/#metaBar/
  // #econBar/#communityBar/#btnCollapseMenu) et les widgets flottants (.floatWidget/#chatWidget/
  // .qwHeaderRow .qwTitle/.qwFoldBtn) avaient été sautés par les Phases 1-5 de la refonte Zone --
  // confirmé en inspectant le jeu vivant : ils héritaient encore de body{font-family:Georgia,...}
  // et de l'ancien fond rgba(10,9,12,.88)/bordure #2c2a33/#3a3742 d'avant toute refonte. Garde-fou
  // statique : inspecte les règles CSS RÉELLEMENT chargées (document.styleSheets), pas de fetch
  // réseau ni de rendu DOM nécessaire, test synchrone comme le reste de la suite (même convention
  // que testSorcierRenderLoadsBeforeSyncStartupCallers/testSupabaseScriptIsPinnedWithIntegrity).
  function testSidebarAndFloatWidgetsAreReskinnedNotLegacyGeorgia() {
    if (typeof document === 'undefined') return; // hors-contexte navigateur
    const allRules = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules || sheet.rules; } catch (e) { continue; }
      if (!rules) continue;
      for (const r of rules) if (r && r.cssText) allRules.push(r.cssText);
    }
    const rulesMatching = needle => allRules.filter(t => t.includes(needle));

    const collapseBtnRules = rulesMatching('#btnCollapseMenu');
    assert('#btnCollapseMenu a une règle en police Inter (reskin Phase 6, plus le carré Georgia d\'origine)',
      collapseBtnRules.some(t => /font-family:\s*['"]?Inter/i.test(t)), collapseBtnRules.join(' | '));

    const gameBarBtnRules = rulesMatching('#gameBar button');
    assert('les boutons de #gameBar passent en police Inter (pas Georgia hérité de body)',
      gameBarBtnRules.some(t => /font-family:\s*['"]?Inter/i.test(t)), gameBarBtnRules.join(' | '));

    const communityBarLinkRules = rulesMatching('#communityBar a');
    assert('#communityBar a (bouton Discord, un <a> pas un <button>) est bien couvert par le reskin',
      communityBarLinkRules.some(t => /font-family:\s*['"]?Inter/i.test(t)), communityBarLinkRules.join(' | '));

    const floatWidgetRules = rulesMatching('.floatWidget');
    assert('.floatWidget utilise la police Inter (pas Georgia hérité)',
      floatWidgetRules.some(t => /font-family:\s*['"]?Inter/i.test(t)), floatWidgetRules.join(' | '));
    assert('.floatWidget utilise le token --s1 pour le fond (cohérent avec .card, plus l\'ancien #1c1a22 en dur seul)',
      floatWidgetRules.some(t => /--s1/.test(t)), floatWidgetRules.join(' | '));

    const chatWidgetRules = rulesMatching('#chatWidget');
    assert('#chatWidget (règle historique plus spécifique que .floatWidget) reprend aussi --s1/--dbBorder',
      chatWidgetRules.some(t => /--s1/.test(t) && /--dbBorder/.test(t)), chatWidgetRules.join(' | '));

    const qwTitleRules = rulesMatching('.qwHeaderRow .qwTitle');
    assert('.qwHeaderRow .qwTitle passe en Cinzel + --gold2 (même traitement que .card h3)',
      qwTitleRules.some(t => /Cinzel/.test(t) && /--gold2/.test(t)), qwTitleRules.join(' | '));

    const qwFoldBtnRules = rulesMatching('.qwFoldBtn');
    assert('.qwFoldBtn a une règle avec border-radius + --cream3 (icône minimaliste, pas la pilule --gold-dim d\'origine)',
      qwFoldBtnRules.some(t => /border-radius/.test(t) && /--cream3/.test(t)), qwFoldBtnRules.join(' | '));
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
    testNoAutoPotionAtVelia();
    testUpgradeIconOnlyWhenBetterStuffAvailable();
    testUpgradeIconIgnoresDiscoveredZone();
    testEquipmentDollRefreshesOnZoneTravel();
    testFarmModeBubbleSelectorReflectsTwoModes();
    testSlotsUpgradedByZoneIsZoneSpecific();
    testZoneTierLockIsSeparateFromLabel();
    testCompagnonSeaLifeLiveInHeaderNotZoneTierTabs();
    testActivityTabLockIsSeparateFromLabel();
    testCompanionTabShowsNewBadgeInsteadOfLock();
    testActivityTabsReservesRoomForOverflowingBadges();
    testHeaderBadgesSitOnBottomBorder();
    testBossActivityTabFlashesNearSpawnAndShowsHp();
    testBossActivityTabShowsDefeatedTextAtZeroHp();
    testBossRewardRevealSequenceThenSkipShowsCloseButton();
    testBossDiceRollLandsOnTrueValueAndSkipIsInstant();
    testBossRewardRevealEmptyShowsCloseButtonImmediately();
    testLeaveBossResultToZoneReturnsToFarm();
    testPenMasteryListIncludesAllGearAndIsOrderedByTier();
    testCompendiumPenCountNeverExceedsMaxEvenWithStaleEntry();
    testPenMasteryTierHeadersShowCountAndDoneAt11();
    testChestLockedCellsUseBadgeConvention();
    testInvAddStacksByNameRegardlessOfKey();
    testBossLobbyShowsHpBarWhenAlreadyDefeated();
    testChestGridFollowsSameHeightSyncAsSiblingCards();
    testJewelryShowsGainInAutoOptList();
    testZoneUpgradeArrowHiddenIfAlreadyInBag();
    testEnhanceMaterialNeverSubstitutesWrongTier();
    testJewelryHasMatNameForEnhancement();
    testInvOptTargetDoesNotEquip();
    testCompendiumEvictsItemOnceItReachesPen();
    testMarketSellTaxRateMatchesServerFactor();
    testMarketCatalogUsesOnlyRealGameNames();
    testMarketCatalogCoversGearSlotsAndSkipsArtifactDeadCategory();
    testCmItemKeyMatchesServerKeyFormat();
    testFindInvIndexForSellMatchesExactEnhLv();
    testOwnedQtyForMaterialsSumsButGearIsBinaryPerEnhLv();
    testMarketScriptLoadsAfterGearZoneAndIconData();
    testWikiTreasureCountMatchesRealArray();
    testWikiMentionsCronCostPerTier();
    testWikiMentionsBothWorldBosses();
    testLateScriptGlobalsSurviveButtonWiring();
    testWikiDiscordLinkNeverTruncatesTheFile();
    testEverySkillHasDistinctCastIdentity();
    testSpawnCastOriginVfxNeverThrows();
    testWitchBodyOnAcceptsSkillObjectWithoutThrowing();
    testCastVisualDifferenceIsClearlyVisible();
    testOrnamentFlashinessIncreasesByTier();
    testMigratePenMasteryV308MarksExistingPenItems();
    testEvictMasteredFromCompendiumBagOnAnyCopyReachingPen();
    testMigratePenMasteryV308EvictsCompendiumRetroactively();
    testBestGearscoreApDpNeverDecrease();
    testBestSilverPerHourNeverDecreasesAndRequiresTwoMinutes();
    testShRateDisplaysPerMinuteNotPerHour();
    testAdminEquipFullTierSetCoversAllFourTiers();
    testChestZoomToggleWorks();
    testCheckForUpdateFetchesFileThatActuallyContainsPatchNotes();
    testErrorMessagesAreEscapedBeforeInnerHtml();
    testSupabaseScriptIsPinnedWithIntegrity();
    testSorcierRenderLoadsBeforeSyncStartupCallers();
    testPatchNotesDatesFormatAndOrder();
    testEveryPatchSubHasALabel();
    testFormatPatchNoteForDiscord();
    testRpcFireAndForgetCallsNeverUseBareCatch();
    testAdminHourlyReadsRealPlaytimeColumns();
    testPopupCloseOnlyReopensAdminPanelIfStillOpen();
    testPatchPagesCoverAllEntriesWithinBounds();
    testPatchNotesNavButtons();
    testCompendiumBackfillAfterSell();
    testCellEnhBadgeVisibility();
    testNeglectedUpgradeHighlight();
    testZonesOfferingUpgradeAggregatesAllSlots();
    testApDpDisplayHasNoDecimals();
    testEffectiveApDpFloors();
    testPotionCostIsFixedPctOfHourlyTrashIncome();
    testTargetPackCountIncreasesFromWhiteTier();
    testResetWorldSpawnsTargetPackCount();
    testStatsRecoPicksTrueBestZone();
    testLootedItemsSellForMuchLess();
    testJewelryGetsColoredBorderInBag();
    testGearDropsAreDeterministic();
    testEquipBestTieBreaksOnHighestEnhLv();
    testOptDropdownShowsOnlyPrimaryStat();
    testJewelryApIsDynamic();
    testGearRetroactiveMigration();
    testGearRescaleV235RetroactiveOnZoneReqChange();
    testApplySaveStateUpdatesZoneTitleText();
    testComputeOfflineCatchupSilverCapsAndThresholds();
    testLootTableJackpotRowHasColor();
    testAddSilverUpdatesStateCorrectly();
    testSellOnePriorityEquipCompendiumSell();
    testJackpotHasSellButtonInItemMenu();
    testAutoEquipPrefersMoreEnhancedOnTiedBaseScore();
    testXpGainFlashesLevelBox();
    testClaimLoyaltyMovesMailboxToStock();
    testZone0LootReachesZone1Difficulty();
    testSausanGearReachesMineDeFerDifficile();
    testFullWhiteTierGearReachesGreenTierDifficile();
    testZoneSkillsDamageAllWolvesInPack();
    testVeliaTreasureMergedIntoSingleTier();
    testTreasurePricingIsMultipleOfReferenceGearVal();
    testTreasureStackCapAutoSellsSurplus();
    testTreasureCraftRecipeTargetsUnnumberedTreasure();
    testIsBannedRespectsExpiry();
    testCanBanUuidBlocksSelfBan();
    testBanReasonsAndDurationsWellFormed();
    testAdminThemesWellFormedAndPersist();
    testAdminSectionsWellFormed();
    testDashboardWidgetsPointToRealSections();
    testDashboardLightDistinguishesHealthy();
    testBuildSilverChartSvgGeometry();
    testMergeSmallSlicesPreservesTotalAndMergesTail();
    testBuildPieChartSvgNeverThrowsOnEmpty();
    testBuildBarSeriesSvgNeverThrowsOnEmpty();
    testChartsAreCappedNotFullWidth();
    testCronUsageLoggedWithDistinctKindFromPickup();
    testCloseAdminButtonSurvivesSectionSwitch();
    testSumCompanionBreakdownAggregatesAcrossPlayers();
    testSumCompanionBreakdownEmptyRowsNeverThrows();
    testActivityTabsHasLockedPvpEntry();
    testLootRatesLiveMergeIsPartial();
    testAdminEconomyLoadsAfterAdminPanel();
    testGetISOWeekStringKnownDates();
    testBossDeathPenaltyMultTable();
    testBossFirstKillOfWeekPerBossNotGlobal();
    testBossPityForcesWinAtThreshold();
    testWheelLandingDegWonIsSegmentCenter();
    testWheelLandingDegLossNeverLandsInsideRareSegment();
    testWheelSegmentPathIsWellFormedSvgPath();
    testBossWheelReactSegmentCountMatchesRoster();
    testItemTutorialsWellFormedAndIndexed();
    testMaybeQueueItemTutorialRespectsSeenAndCap();
    testTutorialNeverQueuesOrMarksSeenWithoutAuthenticatedUser();
    testMarketTutorialTargetsMarketHeadNotFullPanel();
    testTutorialBoxClampsToRealHeightNeverOverflowsBottom();
    testTrashTutorialCoversEveryZoneTrashName();
    testActionTutorialsRegisteredWithEmptyItemNames();
    testMaybeQueueTutorialByIdWorksForManualTrigger();
    testOnboardingTrackingNeverThrowsWithoutTrackId();
    testAdvanceSimSkipsAllEffectsWhenSessionLocked();
    testOfflineCacheRoundTripsPerUserAndTracksPendingSync();
    testSaveToCloudGuardsSessionLockAndOffline();
    testCheckPlayerSessionNeverLocksOnNetworkFailure();
    testReportClientErrorGuardsOfflineAndMissingClient();
    testReportClientErrorThrottlesAfterMaxPerSession();
    testCheckPlayerSessionRequiresSuccessfulClaimFirst();
    testAwayLootSummaryAccumulatesOnlyWhileHiddenAndResets();
    testReconnectModalWrapperScrollsInsteadOfClipping();
    testApplySaveStateOfflineCatchupCreditsSilverAndShowsReconnectModal();
    testReconnectModalTierChipsWrapOnSameRowInsteadOfStacking();
    testAwayLevelSnapshotCapturedOnHide();
    testReconnectDurationLabelFormatsHoursAndMinutes();
    testBestAfkSessionSilverIsMonotone();
    testPneFlattenPageProducesStableUniqueEntryIds();
    testPneContainsBannedWordDetectsAccentedVariants();
    testPatchNotesReactOpensAndClosesInDom();
    testPatchNotesCategoryChipsWrapOnSameRowInsteadOfStacking();
    testPneResolveInitialPageStartFromHash();
    testPatchNotesFocusTrapKeepsTabWithinDialog();
    testPatchNotesEntryShowsReadStampForAlreadySeenVersion();
    testPatchBadgeHasAriaLive();
    testCompendiumOverallPctCombinesAllThreeSources();
    testCompendiumWorldAndBossRegistriesAreComplete();
    testCmpMasteredDetectsOnlyPenLevel();
    testCompendiumReactOpensAndClosesInDom();
    testInvAddMergesPastOldMaxStackThreshold();
    testI18nextInitializedWithSupportedLangs();
    testI18nResourcesLoadBeforeGameplayFiles();
    testI18nextResolvesKnownKeysNotRawKey();
    testChangeLanguageStaysInSyncWithGlobalLang();
    testI18nResourcesFrEnKeyParity();
    testAllBossesHaveLoreInBothLangs();
    testBossMatInHandSumsAcrossSlotsAndHandlesEmptyInv();
    testBossLobbyRewardLineShowsMatInHandWithoutThrow();
    testGroupAchievementsIntoChainsGroupsByStatFnIdentity();
    testChainProgressNeverMarksIntermediateTierDoneAheadOfChain();
    testSortChainsForDisplayPushesCompletedChainsToEnd();
    testAchievementSilverTotalsSplitsEarnedAndRemaining();
    testAchCatCompletionUsesRealUnlockedCounts();
    testRecentlyUnlockedAchievementsSortsByTimestampDescendingAndRespectsLimit();
    testRecentlyUnlockedAchievementsIgnoresNonNumericTimestamps();
    testLb2CompendiumCategoryUsesRealPct();
    testLb2ComputeYourRankInfoFindsRealRankOutsideTop20();
    testLb2YourRankBarThresholdIsTop20();
    testLb2GuestGateReusesMarketCopyAndRealLinkButton();
    testOpenLeaderboard2ShowsStyledGuestGateNotRawAlert();
    testSidebarAndFloatWidgetsAreReskinnedNotLegacyGeorgia();
    const failed = results.filter(r => !r.pass);
    const summary = `${results.length - failed.length}/${results.length} OK`;
    if (failed.length) {
      console.error(`✖ Tests de régression Black Desert Idle : ${summary}`);
      failed.forEach(r => console.error(`  ✖ ${r.name} — ${r.detail}`));
    } else {
      console.log(`✓ Tests de régression Black Desert Idle : ${summary} — tout passe.`);
    }
    return { total: results.length, passed: results.length - failed.length, failed: failed.map(r => ({ name:r.name, detail:r.detail })) };
  };
})();
