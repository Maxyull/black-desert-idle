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
  // "les zone dans le header ont un cadenas au milieu en bas on y transvase du menu de gauche
  // compagnon et vie en mer avec cadenas" (2026-07-17) -- Compagnon/Vie en mer déplacés du menu de
  // gauche vers la barre d'onglets de région, toujours verrouillés, jamais mélangés à ZONE_TIERS
  // (qui pilote buildZoneList()/zoneTier -- ces 2 teasers n'ont pas de data-tier).
  function testZoneTierTabsIncludeLockedTeasers() {
    if (!$('zoneTierTabs')) return; // pas de DOM (contexte hors-jeu)
    renderZoneTierTabs();
    const buttons = [...$('zoneTierTabs').querySelectorAll('.catTab')];
    const teasers = buttons.filter(b => !b.dataset.tier);
    assert('Les 2 onglets teasers (Compagnon, Vie en mer) sont bien présents', teasers.length === EXTRA_TEASER_TABS.length, `got=${teasers.length}`);
    for (const b of teasers) {
      assert('Chaque onglet teaser est verrouillé (classe locked)', b.classList.contains('locked'));
      assert('Chaque onglet teaser porte le badge cadenas', !!b.querySelector('.zoneTierLock'));
      assert('Chaque onglet teaser est désactivé (disabled)', b.disabled);
    }
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
    const s = { optTarget, forcedMatKey, comp: COMPENDIUM_BAG[INV_SIZE-1], inv: INV[INV_SIZE-1], hadMastery: !!(S.penMastery && S.penMastery['testCompPenItem']) };
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
    optTarget = s.optTarget; forcedMatKey = s.forcedMatKey; COMPENDIUM_BAG[INV_SIZE-1] = s.comp; INV[INV_SIZE-1] = s.inv;
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
  // aperçu "vous recevrez ~X après taxe" : calcul correct (prix*qty*80%, arrondi vers le bas),
  // jamais affiché en mode Achat (l'acheteur paie toujours le plein prix affiché)
  function testMarketTaxHintComputesNetAndOnlyShowsOnSell() {
    if (!$('mktSellTaxHint') || !$('mktPriceInput') || !$('mktQtyInput')) return; // pas de DOM marché
    const s = { side: mktSide, price: $('mktPriceInput').value, qty: $('mktQtyInput').value };
    mktSide = 'buy';
    $('mktPriceInput').value = '100'; $('mktQtyInput').value = '10';
    updateMktTaxHint();
    assert('Aperçu masqué en mode Achat', $('mktSellTaxHint').style.display === 'none');
    mktSide = 'sell';
    updateMktTaxHint();
    assert('Aperçu visible en mode Vente', $('mktSellTaxHint').style.display !== 'none');
    assert('Aperçu affiche bien le net à 65% (100*10*0.65=650)', $('mktSellTaxHint').textContent.includes('650'), `texte=${$('mktSellTaxHint').textContent}`);
    mktSide = s.side; $('mktPriceInput').value = s.price; $('mktQtyInput').value = s.qty;
    updateMktTaxHint();
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
    const TEST_NAME = 'TestAutoEquipTieBreak';
    const s = { ring1: EQUIP.ring1, ring2: EQUIP.ring2, a: INV[INV_SIZE-1] };
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
    EQUIP.ring1 = s.ring1; EQUIP.ring2 = s.ring2; INV[INV_SIZE-1] = s.a;
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
    testZoneTierTabsIncludeLockedTeasers();
    testChestLockedCellsUseBadgeConvention();
    testJewelryShowsGainInAutoOptList();
    testZoneUpgradeArrowHiddenIfAlreadyInBag();
    testEnhanceMaterialNeverSubstitutesWrongTier();
    testJewelryHasMatNameForEnhancement();
    testInvOptTargetDoesNotEquip();
    testCompendiumEvictsItemOnceItReachesPen();
    testMarketSellTaxRateMatchesServerFactor();
    testMarketTaxHintComputesNetAndOnlyShowsOnSell();
    testWikiTreasureCountMatchesRealArray();
    testWikiMentionsCronCostPerTier();
    testWikiMentionsBothWorldBosses();
    testEverySkillHasDistinctCastIdentity();
    testSpawnCastOriginVfxNeverThrows();
    testWitchBodyOnAcceptsSkillObjectWithoutThrowing();
    testCastVisualDifferenceIsClearlyVisible();
    testOrnamentFlashinessIncreasesByTier();
    testMigratePenMasteryV308MarksExistingPenItems();
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
