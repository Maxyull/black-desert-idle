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
  // style F "capsule segmentée, texte partout" (2026-07-12, demande explicite après mockup A/B des
  // options E/F/G validé par l'utilisateur : "F pour les 3 avec l'inventaire") -- les 3 sélecteurs à
  // bulles (#aiModeSlider/#farmModeSlider/#equipModeSlider) doivent TOUS afficher leur label texte
  // en PERMANENCE, même sur les segments inactifs (avant : innerHTML conditionnel qui masquait le
  // texte des segments inactifs, seul l'actif avait un <span class="farmModeSegLabel">). Garde-fou
  // contre un retour au morph rond(icône seule)->pilule(icône+texte) de l'ancien style. Vérifie
  // aussi la migration des tokens de la refonte Zone (--s2/--dbBorder, voir CLAUDE.md §29) sur les
  // 3 conteneurs, à la place de l'ancien rgba(10,9,12,.6)/--gold-dim.
  function testBubbleSelectorsStyleFAlwaysShowLabelsAndUseZoneTokens() {
    if (!$('aiModeSlider') || !$('farmModeSlider') || !$('equipModeSlider')) return; // pas de DOM (contexte hors-jeu)
    const s = { aiMode: S.aiCombatMode, farmMode: S.farmMode, equipMode };

    // --- aiModeSlider : tous les segments (actif ET inactifs) gardent leur label ---
    setAiCombatMode('défensif');
    $('aiModeSlider').querySelectorAll('.aiModeSeg').forEach(seg => {
      const label = seg.querySelector('.farmModeSegLabel');
      assert(`aiModeSlider : segment "${seg.dataset.mode}" garde son label même inactif`,
        !!label && label.textContent.length > 0, seg.innerHTML);
    });

    // --- farmModeSlider : idem ---
    setFarmMode('loot');
    $('farmModeSlider').querySelectorAll('.farmModeSeg').forEach(seg => {
      const label = seg.querySelector('.farmModeSegLabel');
      assert(`farmModeSlider : segment "${seg.dataset.mode}" garde son label même inactif`,
        !!label && label.textContent.length > 0, seg.innerHTML);
    });

    // --- equipModeSlider : idem ---
    setEquipMode('gear');
    $('equipModeSlider').querySelectorAll('.equipModeSeg').forEach(seg => {
      const label = seg.querySelector('.farmModeSegLabel');
      assert(`equipModeSlider : segment "${seg.dataset.mode}" garde son label même inactif`,
        !!label && label.textContent.length > 0, seg.innerHTML);
    });

    // --- tokens : conteneurs migrés vers --s2/--dbBorder (rgb(24,24,40)/rgb(42,42,68)), plus
    // l'ancien rgba(10,9,12,.6)/--gold-dim (rgb(10,9,12)/rgb(138,112,56)) ---
    [['aiModeSlider'], ['farmModeSlider'], ['equipModeSlider']].forEach(([id]) => {
      const cs = getComputedStyle($(id));
      assert(`${id} : fond var(--s2) rgb(24, 24, 40) (plus l'ancien rgba(10,9,12,.6))`,
        cs.backgroundColor === 'rgb(24, 24, 40)', cs.backgroundColor);
      assert(`${id} : bordure var(--dbBorder) rgb(42, 42, 68) (plus l'ancien --gold-dim)`,
        cs.borderColor === 'rgb(42, 42, 68)', cs.borderColor);
    });

    // --- segment actif : fond doré plein #c9a55a, texte sombre ; segment inactif : fond transparent ---
    const activeSeg = $('farmModeSlider').querySelector('.farmModeSeg.active');
    const inactiveSeg = $('farmModeSlider').querySelector('.farmModeSeg:not(.active)');
    const csActive = getComputedStyle(activeSeg), csInactive = getComputedStyle(inactiveSeg);
    assert('farmModeSeg.active : fond var(--gold) rgb(201, 165, 90)', csActive.backgroundColor === 'rgb(201, 165, 90)', csActive.backgroundColor);
    assert('farmModeSeg inactif : fond transparent (pas de fond doré résiduel)', csActive.backgroundColor !== csInactive.backgroundColor, csInactive.backgroundColor);

    S.aiCombatMode = s.aiMode; renderAiModeBtn();
    S.farmMode = s.farmMode; renderFarmModeBtn();
    equipMode = s.equipMode; renderEquipModeBtn();
  }
  // repositionnement des sélecteurs #farmModeSlider/#aiModeSlider en haut à droite du cadre de jeu
  // (2026-07-12, demande explicite : "met simplement les sélecteurs d'IA en haut à droite") --
  // remplace l'ancien calage centré symétrique autour de #aiState (left:calc(50%±1px)). Double
  // garde-fou : la RÈGLE CSS de base (ancrée via `right`, plus l'ancien left:calc(50%...)/
  // translateX(-100%)) ET la position RÉELLE rendue (les 2 pilules dans la moitié droite du cadre,
  // empilées verticalement sans se chevaucher). Empêche un retour silencieux au calage centré si
  // quelqu'un retouche ce bloc plus tard.
  function testAiFarmModeSlidersPositionedTopRightWithoutOverlap() {
    if (!$('farmModeSlider') || !$('aiModeSlider') || !$('gameFrame')) return; // pas de DOM (contexte hors-jeu)

    // --- garde-fou statique : règles CSS top-level (hors media query) ---
    const topLevelRules = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules || sheet.rules; } catch (e) { continue; }
      if (!rules) continue;
      for (const r of rules) if (r && r.cssText && !(r instanceof CSSMediaRule)) topLevelRules.push(r.cssText);
    }
    const farmRule = topLevelRules.find(t => t.trim().startsWith('#farmModeSlider'));
    const aiRule = topLevelRules.find(t => t.trim().startsWith('#aiModeSlider'));
    assert('#farmModeSlider (règle de base) existe dans le CSS chargé', !!farmRule, 'introuvable');
    assert('#aiModeSlider (règle de base) existe dans le CSS chargé', !!aiRule, 'introuvable');
    if (farmRule) {
      assert('#farmModeSlider ancré via right (haut à droite), plus via left:calc(50%...)',
        /right:\s*10px/.test(farmRule) && !/left:\s*calc/.test(farmRule), farmRule);
    }
    if (aiRule) {
      assert('#aiModeSlider ancré via right (haut à droite), plus via left:calc(50%...)/translateX(-100%)',
        /right:\s*10px/.test(aiRule) && !/left:\s*calc/.test(aiRule) && !/translateX\(-100%\)/.test(aiRule), aiRule);
    }

    // --- position réelle rendue : les 2 pilules dans le cadre, empilées sans chevauchement, dans la moitié droite ---
    const frame = $('gameFrame').getBoundingClientRect();
    const farm = $('farmModeSlider').getBoundingClientRect();
    const ai = $('aiModeSlider').getBoundingClientRect();
    const frameMid = frame.left + frame.width / 2;
    assert('#farmModeSlider reste horizontalement DANS #gameFrame', farm.left >= frame.left - 1 && farm.right <= frame.right + 1,
      `farm=${JSON.stringify(farm)} frame=${JSON.stringify(frame)}`);
    assert('#aiModeSlider reste horizontalement DANS #gameFrame', ai.left >= frame.left - 1 && ai.right <= frame.right + 1,
      `ai=${JSON.stringify(ai)} frame=${JSON.stringify(frame)}`);
    assert('#farmModeSlider est dans la moitié DROITE du cadre (plus centré)', farm.left > frameMid, `farm.left=${farm.left} frameMid=${frameMid}`);
    assert('#farmModeSlider/#aiModeSlider ont le même bord droit (ancrés à la même distance du bord)',
      Math.abs(farm.right - ai.right) < 3, `farm.right=${farm.right} ai.right=${ai.right}`);
    assert('#aiModeSlider est empilé SOUS #farmModeSlider, sans chevauchement vertical',
      ai.top >= farm.bottom, `farm.bottom=${farm.bottom} ai.top=${ai.top}`);
  }
  // #ztCompendium ("📖 X/Y", compteur Compendium dans #zoneTitle) masqué UNIQUEMENT sur téléphone
  // (2026-07-12, demande explicite : "retire le compteur compendium sur telephone") -- reste visible
  // tel quel sur desktop. Garde-fou statique : la règle display:none doit vivre DANS le bloc
  // @media (max-width:600px), jamais dans la règle de base (sinon il disparaîtrait aussi desktop).
  function testZtCompendiumHiddenOnlyOnMobile() {
    if (typeof document === 'undefined') return;
    let baseRule = null, mobileRule = null;
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules || sheet.rules; } catch (e) { continue; }
      if (!rules) continue;
      for (const r of rules) {
        if (r.cssText && r.cssText.trim().startsWith('#ztCompendium') && !(r instanceof CSSMediaRule)) {
          baseRule = r.cssText;
        }
        if (r instanceof CSSMediaRule && /max-width:\s*600px/.test(r.media.mediaText)) {
          for (const inner of r.cssRules) {
            if (inner.cssText && inner.cssText.trim().startsWith('#ztCompendium')) mobileRule = inner.cssText;
          }
        }
      }
    }
    assert('#ztCompendium a une règle de base (visible par défaut, desktop)', !!baseRule, 'introuvable');
    if (baseRule) assert('#ztCompendium : la règle de base ne masque PAS (display:none) hors media query', !/display:\s*none/.test(baseRule), baseRule);
    assert('#ztCompendium a bien une règle display:none dans @media (max-width:600px)', !!mobileRule && /display:\s*none/.test(mobileRule), mobileRule);
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
  // badge "NEW" RETIRÉ au passage en prod (2026-07-18, "on passe en prod et on lie compagnon avec
  // le jeu") -- Compagnon est sorti de sa phase de test : plus de badge "NEW"/"NOUVEAU"
  // (.actTabNew), et toujours pas de cadenas (locked:false, débloqué). Garde-fou anti-régression :
  // ni NEW ni cadenas sur cet onglet en prod.
  function testCompanionTabShowsNewBadgeInsteadOfLock() {
    if (!$('activityTabs') || typeof renderActivityTabs !== 'function' || typeof ACTIVITY_TABS === 'undefined') return;
    const pet = ACTIVITY_TABS.find(t => t.id === 'pet');
    if (!pet) return;
    assert('ACTIVITY_TABS.pet n\'est plus marqué isNew (sorti de test, prod)', !pet.isNew);
    renderActivityTabs();
    const btn = [...$('activityTabs').querySelectorAll('.actTab')].find(b => b.dataset.id === 'pet');
    assert('Onglet Compagnon trouvé dans le header', !!btn);
    if (!btn) return;
    assert('Onglet Compagnon n\'affiche plus de badge "NEW" (prod)', !btn.querySelector('.actTabNew'));
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
        // référence PARESSEUSE (2026-07-19, découpe d'admin-panel.js) : les render vivent dans
        // admin-players/content/economy/monitoring.js, qui chargent APRÈS le registre. La flèche
        // `render:(el)=>renderX(el)` diffère la résolution à l'appel -- mais si renderX n'existe
        // nulle part (faute de frappe, fonction supprimée/renommée), le clic échouerait seulement
        // À L'EXÉCUTION, en silence. On résout donc ici le nom cible pour le détecter au test.
        if (hasRender) {
          const target = (item.render.toString().match(/=>\s*(\w+)\s*\(/) || [])[1];
          if (target) {
            assert(`"${group.cat}/${item.id}" : son render pointe vers une fonction définie (${target})`,
              typeof window[target] === 'function');
          }
        }
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
  // Reskin Zone du tutoriel (2026-07-12, port fidèle du mockup validé) : #tutorialBox suivait
  // encore l'ancien thème doré (fond #1c1a22 en dur, police Georgia héritée de body, bouton
  // "Suivant" carré, "Précédent" sur l'ancien --gold-dim) -- aligné ici sur .card
  // (var(--s1)/var(--dbBorder)/radius 11px) + boutons radius 8px cohérents avec le reste des CTA
  // (#sessionLockResumeBtn, #btnSignIn...). #tutorialArrow garde --gold, volontairement pas
  // touché (déjà correct selon le mockup). Test réel (pas juste absence d'erreur) : startTutorial()
  // avec de vraies étapes factices + navigation Suivant/Précédent/Passer, comme
  // testSessionLockBoxUsesZoneRedesignTokens/testToastsUseZoneRedesignTokens pour les autres
  // reskins Zone déjà faits.
  function testTutorialBoxUsesZoneRedesignTokens() {
    if (typeof startTutorial !== 'function' || typeof endTutorial !== 'function') return;
    const savedUser = typeof currentUser !== 'undefined' ? currentUser : undefined;
    const savedIdx = tutorialStepIdx, savedSteps = activeTutorialSteps;
    const target = document.createElement('div');
    target.id = 'testTutorialReskinTarget';
    target.style.cssText = 'position:fixed; left:20px; top:100px; width:80px; height:20px;';
    document.body.appendChild(target);
    try {
      if (typeof currentUser !== 'undefined') currentUser = { id:'test-tutorial-reskin', email:'test@test.local' };
      const steps = [
        { target:'#testTutorialReskinTarget', placement:'bottom', title:{fr:'Étape 1', en:'Step 1'}, text:{fr:'Texte 1', en:'Text 1'} },
        { target:'#testTutorialReskinTarget', placement:'bottom', title:{fr:'Étape 2', en:'Step 2'}, text:{fr:'Texte 2', en:'Text 2'} },
        { target:'#testTutorialReskinTarget', placement:'bottom', final:true, title:{fr:'Étape 3', en:'Step 3'}, text:{fr:'Texte 3', en:'Text 3'} },
      ];
      startTutorial(steps, { resetView:false });
      const box = document.getElementById('tutorialBox');
      const h4 = box.querySelector('h4'), p = box.querySelector('p'), step = box.querySelector('.tutStep');
      const skip = document.getElementById('tutSkipBtn'), prev = document.getElementById('tutPrevBtn'), next = document.getElementById('tutNextBtn');
      const cs = getComputedStyle(box);
      assert('#tutorialBox : fond var(--s1) (plus #1c1a22 en dur)', cs.backgroundColor === 'rgb(16, 16, 30)', `backgroundColor=${cs.backgroundColor}`);
      assert('#tutorialBox : bordure var(--dbBorder) (plus var(--gold))', cs.borderColor === 'rgb(42, 42, 68)', `borderColor=${cs.borderColor}`);
      assert('#tutorialBox : radius 11px (comme .card)', cs.borderRadius === '11px', `borderRadius=${cs.borderRadius}`);
      assert('#tutorialBox : police Inter (plus Georgia hérité de body)', /Inter/.test(cs.fontFamily), `fontFamily=${cs.fontFamily}`);
      const csStep = getComputedStyle(step);
      assert('#tutorialBox .tutStep : Cinzel + var(--cream3), petites majuscules',
        /Cinzel/.test(csStep.fontFamily) && csStep.color === 'rgb(88, 80, 64)' && csStep.textTransform === 'uppercase',
        `fontFamily=${csStep.fontFamily} color=${csStep.color} textTransform=${csStep.textTransform}`);
      const csH4 = getComputedStyle(h4);
      assert('#tutorialBox h4 : Cinzel + var(--gold2)', /Cinzel/.test(csH4.fontFamily) && csH4.color === 'rgb(232, 200, 128)', `fontFamily=${csH4.fontFamily} color=${csH4.color}`);
      const csP = getComputedStyle(p);
      assert('#tutorialBox p : Inter + var(--cream2)', /Inter/.test(csP.fontFamily) && csP.color === 'rgb(154, 142, 120)', `fontFamily=${csP.fontFamily} color=${csP.color}`);
      const csSkip = getComputedStyle(skip);
      assert('.tutSkip : Inter + var(--cream3)', /Inter/.test(csSkip.fontFamily) && csSkip.color === 'rgb(88, 80, 64)', `fontFamily=${csSkip.fontFamily} color=${csSkip.color}`);
      const csPrev = getComputedStyle(prev);
      assert('.tutPrev : bordure var(--dbBorder), radius 8px, var(--cream2)',
        csPrev.borderRadius === '8px' && csPrev.color === 'rgb(154, 142, 120)', `borderRadius=${csPrev.borderRadius} color=${csPrev.color}`);
      const csNext = getComputedStyle(next);
      assert('.tutNext : radius 8px (plus carré, border-radius:0)', csNext.borderRadius === '8px', `borderRadius=${csNext.borderRadius}`);
      // navigation réelle Suivant/Précédent/Passer -- le reskin doit survivre à un changement de step
      $a('tutNextBtn').onclick();
      assert('Navigation "Suivant" : passe bien à l\'étape 2/3', document.getElementById('tutStepLbl').textContent.indexOf('2') !== -1,
        document.getElementById('tutStepLbl').textContent);
      assert('Étape 2 : bordure toujours var(--dbBorder) après navigation', getComputedStyle(box).borderColor === 'rgb(42, 42, 68)');
      $a('tutPrevBtn').onclick();
      assert('Navigation "Précédent" : retombe bien sur l\'étape 1/3', document.getElementById('tutStepLbl').textContent.indexOf('1') !== -1,
        document.getElementById('tutStepLbl').textContent);
      endTutorial(true); // Passer
      assert('"Passer" referme bien l\'overlay du tutoriel', !document.getElementById('tutorialOverlay').classList.contains('open'));
    } finally {
      target.remove();
      tutorialStepIdx = savedIdx; activeTutorialSteps = savedSteps;
      if (typeof currentUser !== 'undefined') currentUser = savedUser;
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
  // BUG 1 corrigé le 2026-07-12 ("joueurs invisibles entre eux lors d'un World Boss") :
  // nextBossOccurrence() peut retomber sur bossOccurrences() (planning purement local, sans
  // sharedHp) si liveBoss n'a pas pu être confirmé côté serveur (RPC ensure_scheduled_boss + son
  // repli en échec, tous deux avalés silencieusement avant ce correctif) -- le joueur démarrait
  // alors un combat SOLO en croyant rejoindre du partagé (occ.sharedHp absent -> isShared=false dans
  // startBossFight). computeBossSharedConfirmState() est la version pure (testable sans horloge
  // réelle) de la machine à états qui distingue désormais explicitement confirmed/pending/solo-fallback.
  function testComputeBossSharedConfirmStatePendingThenSoloFallback() {
    if (typeof computeBossSharedConfirmState !== 'function') return;
    const now0 = 1700000000000;
    let r = computeBossSharedConfirmState({ live:true, sharedHp:false }, 0, now0);
    assert('1ère détection (pendingSince=0) : état "pending", pendingSince initialisé à now', r.state === 'pending' && r.pendingSince === now0, JSON.stringify(r));
    r = computeBossSharedConfirmState({ live:true, sharedHp:false }, now0, now0 + 5000);
    assert('Encore dans la fenêtre de tolérance (5s < 15s) : toujours "pending"', r.state === 'pending', JSON.stringify(r));
    r = computeBossSharedConfirmState({ live:true, sharedHp:false }, now0, now0 + BOSS_SHARED_CONFIRM_TIMEOUT_MS + 1);
    assert('Délai de tolérance dépassé : bascule en "solo-fallback" EXPLICITE (jamais un partagé silencieux)', r.state === 'solo-fallback', JSON.stringify(r));
    r = computeBossSharedConfirmState({ live:true, sharedHp:true }, now0, now0 + 1000);
    assert('sharedHp confirmé par le serveur -> "confirmed", pendingSince remis à 0', r.state === 'confirmed' && r.pendingSince === 0, JSON.stringify(r));
    r = computeBossSharedConfirmState(null, now0, now0 + 1000);
    assert('Pas d\'occurrence -> null, pendingSince remis à 0', r.state === null && r.pendingSince === 0, JSON.stringify(r));
    r = computeBossSharedConfirmState({ live:false }, now0, now0 + 1000);
    assert('Occurrence pas encore live -> null (rien à confirmer)', r.state === null, JSON.stringify(r));
  }
  // garde-fou DOM : renderBossLobbyHtml() doit bloquer le bouton "Combattre" en pending (jamais
  // laisser cliquer sur un "partagé implicite" pas encore confirmé) puis basculer sur un bouton actif
  // au libellé HONNÊTE "Combattre en solo" une fois le délai de tolérance dépassé -- jamais un simple
  // "⚔️ Combattre" qui laisserait croire à du partagé alors que occ.sharedHp est absent.
  function testBossLobbyBlocksThenShowsHonestSoloFallbackWhenSharedUnconfirmed() {
    if (typeof renderBossLobbyHtml !== 'function' || typeof nextBossOccurrence !== 'function') return;
    const origNextBossOccurrence = nextBossOccurrence, origPendingSince = sharedPendingSince, origLiveBoss = liveBoss;
    liveBoss = null; // aucune confirmation serveur possible pour ce test
    nextBossOccurrence = () => ({ boss:'kzarka', time: Date.now(), live:true }); // pas de sharedHp -> non confirmé
    try {
      sharedPendingSince = 0; // 1ère détection : pending
      let div = document.createElement('div'); div.innerHTML = renderBossLobbyHtml();
      let btn = div.querySelector('#bossFightBtn');
      assert('État "pending" : le bouton Combattre est bloqué (disabled)', btn && btn.disabled, btn && btn.outerHTML);
      sharedPendingSince = Date.now() - BOSS_SHARED_CONFIRM_TIMEOUT_MS - 1000; // délai dépassé
      div = document.createElement('div'); div.innerHTML = renderBossLobbyHtml();
      btn = div.querySelector('#bossFightBtn');
      assert('État "solo-fallback" : le bouton redevient actif', btn && !btn.disabled, btn && btn.outerHTML);
      assert('État "solo-fallback" : le libellé N\'EST PAS le "Combattre" partagé standard (message honnête)',
        btn && btn.textContent !== i18next.t('combat:combat.boss.fight_button'), btn && btn.textContent);
    } finally {
      nextBossOccurrence = origNextBossOccurrence; sharedPendingSince = origPendingSince; liveBoss = origLiveBoss;
    }
  }
  // BUG 2 corrigé le 2026-07-12 ("fausse récompense déjà réclamée") : boss_contribute (SQL) plafonne
  // CHAQUE appel à 5% du max_hp, donc le PV serveur d'un boss partagé baisse forcément plus lentement
  // que la prédiction locale d'un joueur à fort DPS (décrémentée sans plafond, voir bossLoop). Avant
  // ce correctif, endBossFight(true) partait dès que la prédiction LOCALE atteignait 0, et boss_claim
  // (qui n'accorde la récompense QUE si le PV SERVEUR est <=0) refusait avec un faux "déjà réclamée".
  // bossShouldDeclareVictory() est la fonction pure qui décide désormais de la victoire.
  function testBossSharedVictoryOnlyFromServerConfirmationNeverLocalPrediction() {
    if (typeof bossShouldDeclareVictory !== 'function') return;
    assert('Solo : localHp<=0 déclare la victoire (pas de serveur à attendre)', bossShouldDeclareVictory(false, 0, false) === true);
    assert('Solo : localHp>0 ne déclare pas la victoire', bossShouldDeclareVictory(false, 10, false) === false);
    assert('Partagé : localHp<=0 SANS confirmation serveur NE déclare PAS victoire (régression bug 2026-07-12)', bossShouldDeclareVictory(true, 0, false) === false);
    assert('Partagé : confirmation serveur déclare victoire même si localHp affiche encore >0 (bar visuelle en retard)', bossShouldDeclareVictory(true, 5000, true) === true);
    assert('Partagé : ni local ni serveur -> pas de victoire', bossShouldDeclareVictory(true, 100, false) === false);
  }
  // applyBossContributeResponse() : seule porte d'entrée qui doit faire passer serverConfirmedDead
  // à true -- doit ignorer une réponse vide/en erreur sans lever, et ne jamais "dé-confirmer" un état
  // déjà mort si une réponse tardive renvoyait un hp>0 par accident (protection défensive : le
  // serveur ne fait que décroître le hp, mais le test documente l'intention si ce n'était pas le cas).
  function testApplyBossContributeResponseSetsServerConfirmedDeadOnlyWhenHpReachesZero() {
    if (typeof applyBossContributeResponse !== 'function') return;
    const state = { hp: 5000, maxHp: 50000, serverConfirmedDead: false };
    applyBossContributeResponse([{ hp: 2000, max_hp: 50000 }], state);
    assert('hp mis à jour depuis la réponse AUTORITAIRE du serveur', state.hp === 2000, state.hp);
    assert('Pas encore confirmé mort tant que le serveur renvoie hp>0', state.serverConfirmedDead === false);
    applyBossContributeResponse([{ hp: 0, max_hp: 50000 }], state);
    assert('serverConfirmedDead passe à true quand le SERVEUR renvoie hp<=0', state.serverConfirmedDead === true);
    const state2 = { hp: 100, maxHp: 50000, serverConfirmedDead: false };
    applyBossContributeResponse(null, state2);
    assert('Réponse vide/absente : ne touche pas au state, ne lève pas', state2.hp === 100 && state2.serverConfirmedDead === false);
    applyBossContributeResponse([], state2);
    assert('Tableau vide : idem, aucun effet', state2.hp === 100 && state2.serverConfirmedDead === false);
  }
  // garde-fou statique : empêche qu'une future modif ré-inline un simple "bossState.hp <= 0" pour
  // décider la victoire d'un combat PARTAGÉ (régression facile à réintroduire par inadvertance lors
  // d'un futur refactor de bossLoop) -- bossLoop doit toujours déléguer à bossShouldDeclareVictory().
  function testBossLoopDelegatesSharedVictoryDecisionToPureHelper() {
    if (typeof bossLoop !== 'function') return;
    const src = bossLoop.toString();
    assert('bossLoop() appelle bossShouldDeclareVictory() pour décider de la victoire (jamais un hp<=0 direct pour le partagé)',
      /bossShouldDeclareVictory\s*\(/.test(src));
    assert('bossLoop() route la réponse boss_contribute via applyBossContributeResponse() (pas une réassignation directe de bossState.hp)',
      /applyBossContributeResponse\s*\(/.test(src));
  }
  // garde-fou statique : refreshLiveBoss() ne doit plus jamais avaler une erreur réseau SANS trace --
  // régression facile à réintroduire (retour à un simple try/catch(e){}) qui a directement causé le
  // bug 1 (liveBoss jamais confirmé, aucun moyen de diagnostiquer pourquoi en prod).
  function testRefreshLiveBossLogsAndRetriesOnFailure() {
    if (typeof refreshLiveBoss !== 'function') return;
    const src = refreshLiveBoss.toString();
    assert('refreshLiveBoss() logue explicitement (console.warn) en cas d\'échec', /console\.warn/.test(src));
    assert('refreshLiveBoss() relance (setTimeout) après un échec plutôt que d\'attendre le prochain tick de 20s', /setTimeout\s*\(\s*refreshLiveBoss/.test(src));
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
  // "j'ai des items protégé compendium dans mon sac tuvala qui sont deja pen compendium"
  // (2026-07-13) : bug réel -- si invAdd() échouait (sac plein) au moment où
  // evictMasteredFromCompendiumBag() était appelée (au moment d'atteindre PEN, ou via la
  // migration migratePenMasteryV308, gatée/exécution unique), l'objet restait protégé POUR
  // TOUJOURS -- rien ne relançait jamais l'éviction pour ce nom ensuite. Vérifie que le balayage
  // NON gaté ajouté dans applySaveState() (même ligne que celle rejouée ici) répare bien un objet
  // resté coincé alors que S.penMastery est déjà vrai pour son nom, dès qu'une place se libère.
  function testCompendiumSweepRescuesStuckMasteredItemOnEveryLoad() {
    // sauvegarde l'INV ENTIER (pas juste un slot) : contrairement aux autres tests Compendium de
    // ce fichier, celui-ci a justement besoin d'un sac RÉELLEMENT plein (0 slot libre nulle part)
    // pour prouver que l'éviction échoue proprement -- supposer que le compte de test a déjà le
    // sac plein (comme le suggère CLAUDE.md section 11) s'est avéré faux dans cet environnement
    // Playwright précis (échec constaté : invAdd() trouvait un slot libre ailleurs).
    const savedInv = INV.slice();
    const s = { comp: COMPENDIUM_BAG[INV_SIZE-1], hadMastery: !!(S.penMastery && S.penMastery['testStuckPenItem']) };
    for (let i = 0; i < INV_SIZE-1; i++) INV[i] = { key:'filler'+i, name:'Filler', kind:'material', qty:1, stackable:true, weight:0, val:0 };
    // simule l'état bloqué : déjà maîtrisé, mais toujours protégé dans le Compendium (comme si
    // invAdd() avait échoué la 1re fois) -- sac plein au départ (0 slot libre), puis une place
    // se libère (comme un joueur qui vend/range quelque chose entre-temps).
    const item = { name:'testStuckPenItem', kind:'gear', slot:'weapon', ap:5, dp:0, hp:0, enhLv: ENH_NAMES.length-1, optimizable:true, matName:'Pierre du Temps' };
    COMPENDIUM_BAG[INV_SIZE-1] = item;
    INV[INV_SIZE-1] = { key:'mat_Pierre du Temps', name:'Pierre du Temps', kind:'material', qty:5, stackable:true, weight:0.1, val:1 };
    if (!S.penMastery) S.penMastery = {};
    S.penMastery['testStuckPenItem'] = true; // déjà maîtrisé, mais l'éviction n'a jamais réussi
    // sac RÉELLEMENT plein (0 slot null dans tout INV) : le balayage ne peut rien faire, l'objet reste protégé (pas perdu)
    new Set(COMPENDIUM_BAG.filter(Boolean).map(it => it.name)).forEach(evictMasteredFromCompendiumBag);
    assert('Sac plein : l\'objet coincé reste protégé (pas perdu, juste pas encore évacuable)', COMPENDIUM_BAG[INV_SIZE-1] !== null);
    // une place se libère (le joueur range/vend quelque chose) -- le balayage suivant doit réussir
    const freeIdx = INV_SIZE-2;
    INV[freeIdx] = null;
    new Set(COMPENDIUM_BAG.filter(Boolean).map(it => it.name)).forEach(evictMasteredFromCompendiumBag);
    assert('Place libérée : le balayage rattrape l\'objet resté coincé, sans attendre un nouvel enchantement', COMPENDIUM_BAG[INV_SIZE-1] === null);
    const movedIdx = INV.findIndex(x => x && x.name === 'testStuckPenItem');
    assert('L\'objet rattrapé rejoint bien le sac principal', movedIdx !== -1);
    for (let i = 0; i < INV_SIZE; i++) INV[i] = savedInv[i];
    COMPENDIUM_BAG[INV_SIZE-1] = s.comp;
    if (s.hadMastery) S.penMastery['testStuckPenItem'] = true; else delete S.penMastery['testStuckPenItem'];
  }
  // "taxe market 20% dorenavant" (2026-07-18) -- garde-fou de synchronisation : la constante
  // client MARKET_SELL_TAX_RATE (aperçu affiché avant de placer un ordre, voir
  // updateMktTaxHint()) doit rester alignée sur le facteur réel appliqué côté serveur
  // (market_match_item/market_sell_material, migration 20260718110000_market_sales_tax_20pct.sql,
  // "* 0.8"). Ne peut pas vérifier le SQL directement depuis ce fichier client -- documente et
  // fige la valeur attendue pour qu'un futur changement du taux SQL sans toucher ce fichier soit
  // repéré au moins côté rappel (voir le commentaire au-dessus de MARKET_SELL_TAX_RATE).
  // Sceau du Conclave des Marchands (2026-07-13/22, port de mockup, voir CLAUDE.md pour le detail
  // de la spec). Reserve 2 slots INV libres explicitement (memes precautions que
  // testCompendiumEvictsItemOnceItReachesPen, voir commentaire ci-dessus/CLAUDE.md section 11).
  function testConclaveSealOnlyVeliaFragmentUnlocked() {
    if (typeof CONCLAVE_SEAL_FRAGMENTS === 'undefined') return;
    const veliaFrag = CONCLAVE_SEAL_FRAGMENTS.find(f => f.tierId === 'early');
    assert('Fragment de Velia marqué débloqué', conclaveSealFragmentUnlocked(veliaFrag.tierId));
    ['mid','end','end2','end3'].forEach(tierId => {
      assert(`Fragment ${tierId} marqué verrouillé (région pas encore sortie)`, !conclaveSealFragmentUnlocked(tierId));
    });
  }
  function testConclaveSealAssembleFailsWithoutAllFiveFragments() {
    if (typeof craftConclaveSeal === 'undefined') return;
    const savedHasSeal = S.hasConclaveMarchandsSeal, savedRegions = S.conclaveSealRegions;
    // sans manipuler INV: l'inventaire du compte de test ne contient normalement aucun des 5
    // fragments (item très rare, jamais ajouté par un autre test) -- vérifie juste l'échec attendu
    S.hasConclaveMarchandsSeal = false; S.conclaveSealRegions = [];
    const ok = craftConclaveSeal();
    assert('Assemblage échoue sans les 5 fragments (seul Velia obtenable aujourd\'hui)', ok === false);
    assert('S.hasConclaveMarchandsSeal reste false', S.hasConclaveMarchandsSeal === false);
    S.hasConclaveMarchandsSeal = savedHasSeal; S.conclaveSealRegions = savedRegions;
  }
  function testConclaveSealAssembleSucceedsWithAllFiveFragmentsSimulated() {
    if (typeof craftConclaveSeal === 'undefined') return;
    // simule la possession des 5 fragments (y compris les 4 verrouillés -- vérifie que
    // craftConclaveSeal() ne se soucie que de l'INVENTAIRE, pas du statut locked, cohérent avec le
    // fait qu'un admin/debug pourrait un jour les forcer ; le VRAI blocage vient du drop table, testé séparément).
    const savedHasSeal = S.hasConclaveMarchandsSeal, savedRegions = S.conclaveSealRegions;
    S.hasConclaveMarchandsSeal = false; S.conclaveSealRegions = [];
    const freeIdxs = [];
    for (let i = 0; i < INV_SIZE && freeIdxs.length < 5; i++) if (INV[i] === null) freeIdxs.push(i);
    if (freeIdxs.length === 5) {
      const savedSlots = freeIdxs.map(i => INV[i]);
      CONCLAVE_SEAL_FRAGMENTS.forEach((f, i) => {
        INV[freeIdxs[i]] = { key:f.key, name:f.name, kind:'treasure', icon:f.icon, color:f.color, qty:1, stackable:false, weight:0.05, val:1 };
      });
      const ok = craftConclaveSeal();
      assert('Assemblage réussit avec les 5 fragments', ok === true);
      assert('S.hasConclaveMarchandsSeal devient true', S.hasConclaveMarchandsSeal === true);
      assert('S.conclaveSealRegions enregistre les 5 régions', S.conclaveSealRegions.length === 5);
      assert('Les 5 fragments sont consommés (retirés du sac)', freeIdxs.every(i => INV[i] === null));
      const ok2 = craftConclaveSeal();
      assert('Ré-assemblage refusé (unique par compte)', ok2 === false);
      freeIdxs.forEach((i, idx) => INV[i] = savedSlots[idx]);
    }
    S.hasConclaveMarchandsSeal = savedHasSeal; S.conclaveSealRegions = savedRegions;
  }
  function testConclaveSealMarketEffectsGatedByAssembly() {
    if (typeof conclaveSealEffectiveSellKeepFraction === 'undefined') return;
    const savedHasSeal = S.hasConclaveMarchandsSeal, savedRegions = S.conclaveSealRegions;
    S.hasConclaveMarchandsSeal = false; S.conclaveSealRegions = [];
    assert('Sans Sceau : fraction conservée = 1-taxe (0.65)', Math.abs(conclaveSealEffectiveSellKeepFraction() - 0.65) < 1e-9);
    assert('Sans Sceau : passif régional nul', conclaveSealRegionalBonusPct('early') === 0);
    S.hasConclaveMarchandsSeal = true; S.conclaveSealRegions = ['early'];
    const kept = conclaveSealEffectiveSellKeepFraction();
    assert('Avec Sceau : fraction conservée augmente (0.7884 attendu)', Math.abs(kept - 0.7884) < 1e-6, `got=${kept}`);
    assert('Avec Sceau : passif régional +2% sur Velia (région possédée)', Math.abs(conclaveSealRegionalBonusPct('early') - 0.02) < 1e-9);
    assert('Avec Sceau : passif régional nul sur une région NON possédée', conclaveSealRegionalBonusPct('mid') === 0);
    S.hasConclaveMarchandsSeal = savedHasSeal; S.conclaveSealRegions = savedRegions;
  }
  // passif générique, pas câblé en dur sur Velia (CLAUDE.md, demande explicite) -- vérifie que la
  // fonction lit bien S.conclaveSealRegions dynamiquement plutôt qu'un id fixe.
  function testConclaveSealRegionalPassiveIsGenericNotHardcodedToVelia() {
    if (typeof conclaveSealRegionalBonusPct === 'undefined') return;
    const savedHasSeal = S.hasConclaveMarchandsSeal, savedRegions = S.conclaveSealRegions;
    S.hasConclaveMarchandsSeal = true; S.conclaveSealRegions = ['mid','end2'];
    assert('Passif suit S.conclaveSealRegions (mid)', conclaveSealRegionalBonusPct('mid') === 0.02);
    assert('Passif suit S.conclaveSealRegions (end2)', conclaveSealRegionalBonusPct('end2') === 0.02);
    assert('Passif nul sur une région absente de la liste (early)', conclaveSealRegionalBonusPct('early') === 0);
    S.hasConclaveMarchandsSeal = savedHasSeal; S.conclaveSealRegions = savedRegions;
  }
  function testMarketSellTaxRateMatchesServerFactor() {
    if (typeof MARKET_SELL_TAX_RATE === 'undefined') return; // pas de DOM/module marché chargé
    assert('MARKET_SELL_TAX_RATE vaut bien 35% (0.65 côté SQL)', MARKET_SELL_TAX_RATE === 0.35, `got=${MARKET_SELL_TAX_RATE}`);
  }
  // bug réel trouvé en conditions réelles (2026-07-22, "borne le marché commun et mets-y un scroll") :
  // .marketPane sans display:flex faisait que .cmMarketLayout{flex:1;min-height:0} ne servait à rien
  // (flex:1 sur un enfant non-flex-item est un no-op) -- .cmMarketLayout ne prenait que sa hauteur de
  // contenu naturelle (mesuré 144px sur 657px disponibles), #marketBox entier défilait comme un seul
  // bloc au lieu que chaque colonne (catégories/liste/détail/mes ordres) défile indépendamment dans
  // un cadre borné. Garde-fou statique (inspection des règles CSS réellement chargées, même
  // convention que testSidebarAndFloatWidgetsAreReskinnedNotLegacyGeorgia).
  function testMarketPaneIsFlexColumnSoInnerColumnsScrollIndependently() {
    if (typeof document === 'undefined') return;
    const allRules = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules || sheet.rules; } catch (e) { continue; }
      if (!rules) continue;
      for (const r of rules) if (r && r.cssText) allRules.push(r.cssText);
    }
    const marketPaneRule = allRules.find(t => t.trim().startsWith('.marketPane'));
    assert('.marketPane existe bien dans le CSS chargé', !!marketPaneRule, 'règle introuvable');
    if (!marketPaneRule) return;
    assert('.marketPane est un conteneur flex (sinon .cmMarketLayout{flex:1} ne borne rien)', /display:\s*flex/.test(marketPaneRule), marketPaneRule);
    assert('.marketPane a min-height:0 (sinon un enfant flex:1 peut quand même déborder son conteneur)', /min-height:\s*0/.test(marketPaneRule), marketPaneRule);
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
  // bug rapporté par un joueur : "j'ai mis un item PEN en vente et il est encore dans mon
  // inventaire" -- cause racine : le handler de soumission de vente (wireCmOfferForms(),
  // sellSubmit.onclick) ne retirait JAMAIS l'objet du sac LOCAL après un succès de vente, ne
  // comptant que sur `await loadCloudSave()` (aller-retour réseau complet) pour rafraîchir
  // l'affichage. Ça ouvrait une fenêtre de course avec l'autosave cloud périodique (saveToCloud(),
  // game-supabase.js, toutes les 30s) : `saveToCloud()` fait un `upsert` COMPLET de getSaveState()
  // depuis l'état CLIENT courant -- si cet autosave se déclenchait entre la mutation SQL directe
  // du RPC market_place_order (qui retire déjà l'objet côté serveur) et la fin de loadCloudSave(),
  // il réécrivait save_data avec le sac client encore périmé (objet toujours présent), et
  // loadCloudSave() retéléchargeait ensuite cet état périmé -- l'objet "réapparaissait". Garde-fou
  // statique (même famille que testSorcierRenderLoadsBeforeSyncStartupCallers, voir CLAUDE.md
  // §11) : vérifie que le retrait/la décrémentation locale de INV[invIndex] intervient bien AVANT
  // tout `await loadCloudSave()` dans le handler de vente, pour que ce correctif ne puisse pas
  // silencieusement régresser (ex: un futur refactor qui réordonnerait les lignes).
  function testMarketSellRemovesInvLocallyBeforeCloudReload() {
    if (typeof wireCmOfferForms === 'undefined') return;
    const src = wireCmOfferForms.toString();
    const sellHandlerStart = src.indexOf('sellSubmit.onclick');
    assert('wireCmOfferForms définit bien sellSubmit.onclick', sellHandlerStart !== -1);
    const sellHandlerSrc = src.slice(sellHandlerStart);
    const idxInvMutation = sellHandlerSrc.search(/INV\[invIndex\]\s*=\s*null|invRemoveAt\(invIndex/);
    const idxLoadCloudSave = sellHandlerSrc.indexOf('loadCloudSave()');
    assert('le handler de vente retire/décrémente INV[invIndex] localement (gear -> null, matériau -> invRemoveAt)', idxInvMutation !== -1);
    assert('await loadCloudSave() est bien présent dans le handler de vente', idxLoadCloudSave !== -1);
    assert('le retrait local de INV a lieu AVANT loadCloudSave() (élimine la fenêtre de course avec l\'autosave périodique)',
      idxInvMutation !== -1 && idxLoadCloudSave !== -1 && idxInvMutation < idxLoadCloudSave,
      `idxInvMutation=${idxInvMutation} idxLoadCloudSave=${idxLoadCloudSave}`);
  }
  // vérifie le comportement réel de la mutation locale utilisée par ce handler (pas seulement sa
  // position dans la source) : un gear/bijou vendu doit disparaître entièrement (INV[i]=null), un
  // matériau vendu en partie doit voir sa quantité décroître SANS disparaître (invRemoveAt),
  // vendu en totalité doit lui aussi disparaître -- couvre gear ET matériau comme demandé (le bug
  // rapporté portait sur un item PEN/gear, mais le même correctif s'applique aux deux chemins).
  // Slots réservés (INV_SIZE-1/-2) restaurés en fin de test, voir la règle mémoire sur les tests
  // qui dépendent d'un slot INV libre (sac plein sur le compte de démo).
  function testSellHandlerLocalMutationMatchesServerSemantics() {
    if (typeof invRemoveAt === 'undefined') return;
    const saved = { a: INV[INV_SIZE-1], b: INV[INV_SIZE-2] };
    // cas gear : vente totale (qty=1 toujours pour gear/bijou côté serveur) -> le slot doit disparaître
    INV[INV_SIZE-1] = { name:'Bâton Naru', kind:'gear', slot:'weapon', enhLv:15, key:'pen_test' };
    const gearInvIndex = INV_SIZE-1;
    if (INV[gearInvIndex].kind === 'material') invRemoveAt(gearInvIndex, 1); else INV[gearInvIndex] = null;
    assert('objet gear/PEN vendu : disparaît immédiatement du sac local (INV[i] === null)', INV[gearInvIndex] === null);
    // cas matériau : vente PARTIELLE -> la quantité diminue, le slot reste
    INV[INV_SIZE-2] = { name:'Pierre de Novice', kind:'material', qty:10, stackable:true, key:'mat_test' };
    const matInvIndex = INV_SIZE-2;
    const matQtySold = 3;
    if (INV[matInvIndex].kind === 'material') invRemoveAt(matInvIndex, matQtySold); else INV[matInvIndex] = null;
    assert('matériau vendu partiellement : quantité décrémentée (10-3=7), slot toujours présent', INV[matInvIndex] && INV[matInvIndex].qty === 7, `got=${INV[matInvIndex] && INV[matInvIndex].qty}`);
    // cas matériau : vente TOTALE -> le slot doit disparaître (comme le gear)
    if (INV[matInvIndex].kind === 'material') invRemoveAt(matInvIndex, 7); else INV[matInvIndex] = null;
    assert('matériau vendu en totalité : disparaît du sac local (INV[i] === null)', INV[matInvIndex] === null);
    INV[INV_SIZE-1] = saved.a; INV[INV_SIZE-2] = saved.b;
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
  // Classement GS : écarte les records figés sous un équilibrage antérieur (bestAp/bestDp ne
  // redescendent jamais + migration de recalcul CÔTÉ CLIENT => un joueur parti avant un nerf garde
  // un record d'avant-nerf intouchable). Cas réel du 2026-07-22 : GS 435 en tête alors que le max
  // atteignable est 424. Voir BALANCE_VERSION (game-core.js) et LB2_CATS_().gs.filter.
  function testLb2GsLadderExcludesStaleBalanceRecords() {
    if (typeof lb2Sorted !== 'function' || typeof BALANCE_VERSION !== 'number') return;
    const actif  = { user_id:'bv-actif',  gearscore:424, ap:697.4, dp:149.7, silver:100, balance_version:BALANCE_VERSION };
    const fossile= { user_id:'bv-fossile',gearscore:435, ap:697.4, dp:171.7, silver:200, balance_version:BALANCE_VERSION - 1 };
    const jamais = { user_id:'bv-jamais', gearscore:430, ap:697.4, dp:162.6, silver:300 }; // colonne absente (ligne d'avant la migration)
    const gs = lb2Sorted('gs', [actif, fossile, jamais]);
    assert('Classement GS : le record figé sous un ancien équilibrage est écarté (pas de score fantôme en tête)',
      gs.length === 1 && gs[0].user_id === 'bv-actif', `gs=${gs.map(r=>r.user_id).join(',')}`);
    assert('Classement GS : une ligne sans balance_version (jamais resynchronisée) est écartée aussi',
      !gs.some(r => r.user_id === 'bv-jamais'));
    // le joueur reste classé normalement là où l'équilibrage du stuff n'entre pas en jeu
    const silver = lb2Sorted('silver', [actif, fossile, jamais]);
    assert('Le joueur écarté du GS reste classé au silver (l\'équilibrage du stuff n\'affecte que le GS)',
      silver.length === 3 && silver[0].user_id === 'bv-jamais', `silver=${silver.map(r=>r.user_id).join(',')}`);
  }
  // Écran d'auth à modes (2026-07-22) : AUTH_MODES est la seule source de vérité "quels champs pour
  // quelle intention". Garde-fou contre un flux ajouté sans champ, ou un champ oublié.
  function testAuthModesWellFormed() {
    if (typeof AUTH_MODES === 'undefined') return;
    const inputs = ['authEmail','authPseudo','authPass'];
    Object.keys(AUTH_MODES).forEach(k => {
      const m = AUTH_MODES[k];
      assert(`AUTH_MODES.${k} ouvre au moins un champ`, Array.isArray(m.fields) && m.fields.length > 0);
      assert(`AUTH_MODES.${k} n'ouvre que des champs réels`, m.fields.every(f => inputs.includes(f)), m.fields.join(','));
      assert(`AUTH_MODES.${k} a un handler de validation`, typeof m.run === 'function');
      assert(`AUTH_MODES.${k} a un libellé de bouton traduit FR/EN`,
        !!(I18N[m.submitKey] && I18N[m.submitKey].fr && I18N[m.submitKey].en), m.submitKey);
    });
    // le contrat demandé : connexion = identifiant+mdp, inscription = les 3, oubli/magic = identifiant seul
    assert('Connexion : identifiant + mot de passe', AUTH_MODES.signin.fields.join(',') === 'authEmail,authPass');
    assert('Inscription : email + pseudo + mot de passe (les 3)', AUTH_MODES.signup.fields.join(',') === 'authEmail,authPseudo,authPass');
    assert('Mot de passe oublié : identifiant seul', AUTH_MODES.forgot.fields.join(',') === 'authEmail');
    assert('Lien magique : identifiant seul', AUTH_MODES.magic.fields.join(',') === 'authEmail');
    // l'inscription exige un vrai email : elle ne doit PAS proposer "pseudo ou email"
    assert('Inscription : le champ email n\'accepte pas un pseudo (placeholder dédié)',
      AUTH_MODES.signup.idPh === 'authEmailPh' && AUTH_MODES.signin.idPh === 'authIdentifierPh');
  }
  // Aucune simulation tant que l'état de sauvegarde n'est pas connu (2026-07-22, bug remonté :
  // "on arrive avec un lvl déjà établi" + notif hors-ligne sans compte). Mesuré avant correction :
  // 6 s devant l'écran de connexion faisaient passer niveau 1 -> 5. Garde-fou contre le retour du
  // bug si quelqu'un réordonne les gardes de advanceSim.
  function testAdvanceSimDoesNothingBeforeSaveReady() {
    if (typeof advanceSim !== 'function' || typeof saveReady === 'undefined') return;
    const was = saveReady, lvl0 = S.lvl, kills0 = S.kills || 0, silver0 = S.silver || 0;
    try {
      saveReady = false;
      // 60 s simulées d'un coup : sans la garde, largement de quoi tuer/looter/monter de niveau
      advanceSim(performance.now() + 60000);
      assert('advanceSim ne simule RIEN tant que saveReady est faux (niveau inchangé)', S.lvl === lvl0, `lvl ${lvl0} -> ${S.lvl}`);
      assert('advanceSim ne simule RIEN tant que saveReady est faux (aucun kill)', (S.kills || 0) === kills0);
      assert('advanceSim ne simule RIEN tant que saveReady est faux (aucun silver)', (S.silver || 0) === silver0);
    } finally { saveReady = was; }
  }
  // Croix de fermeture CONDITIONNELLE de l'écran d'auth (2026-07-22) : un invité qui ouvre cet
  // écran ("Lier un compte" / bandeau de fin de vie) a une partie qui tourne derrière et doit
  // pouvoir y revenir ; sans session, l'écran reste un mur sans échappatoire (retrait du
  // 2026-07-16). Garde-fou : ré-afficher la croix inconditionnellement recasserait le mur.
  function testCloseAuthOnlyWithSession() {
    if (typeof showAuthOverlay !== 'function' || !$a('closeAuth')) return;
    const savedUser = currentUser, savedRec = inPasswordRecovery;
    const shown = () => getComputedStyle($a('closeAuth')).display !== 'none';
    try {
      currentUser = null; inPasswordRecovery = false; showAuthOverlay(true);
      assert('Écran d\'auth sans session : pas de croix (le mur doit rester un mur)', !shown());
      currentUser = { id: 'test-guest' }; showAuthOverlay(true);
      assert('Écran d\'auth avec session (invité) : la croix permet de revenir au jeu', shown());
      inPasswordRecovery = true; showAuthOverlay(true);
      assert('Récupération de mot de passe : pas de croix (le joueur doit aller au bout)', !shown());
    } finally {
      inPasswordRecovery = savedRec; currentUser = savedUser; showAuthOverlay(false);
    }
  }
  // Butin rare groupé avant envoi Discord (2026-07-22) : à l'endgame les drops "rares" tombent
  // ~3x/min (154 kills/min × 2%), soit ~2300 messages/jour pour un SEUL joueur (chiffre relevé en
  // prod) -- un message par drop saturait le salon et, vers ~20 joueurs, la limite du webhook.
  function testBuildLootDiscordSummaryGroupsByItem() {
    if (typeof buildLootDiscordSummary !== 'function') return;
    assert('Récap butin : tampon vide -> rien à poster (pas de message inutile)',
      buildLootDiscordSummary({}, 'Naïka') === null);
    const s = buildLootDiscordSummary({ 'gear Bâton Grunil': 4, 'gear Dague Grunil': 1, 'jackpot Anneau X': 2 }, 'Naïka');
    assert('Récap butin : un seul message pour N drops', !!s && typeof s.desc === 'string');
    assert('Récap butin : le pseudo est présent', s.desc.includes('Naïka'));
    assert('Récap butin : total équipements agrégé (4+1=5)', /\*\*5\*\* équipements rares/.test(s.desc), s.desc);
    assert('Récap butin : total bijoux agrégé', /\*\*2\*\* bijoux rares/.test(s.desc), s.desc);
    assert('Récap butin : quantité par objet (×4)', s.desc.includes('Bâton Grunil ×4'), s.desc);
    assert('Récap butin : pas de "×1" superflu pour un objet unique',
      s.desc.includes('Dague Grunil') && !s.desc.includes('Dague Grunil ×1'), s.desc);
    assert('Récap butin : les plus nombreux en premier',
      s.desc.indexOf('Bâton Grunil') < s.desc.indexOf('Dague Grunil'), s.desc);
    // au-delà de DISCORD_LOOT_MAX_NAMES : "et N autres" (l'embed Discord est borné à 2000 caractères)
    const many = {}; for (let i = 0; i < 12; i++) many['gear Objet' + i] = 1;
    const big = buildLootDiscordSummary(many, 'X');
    assert('Récap butin : la liste de noms est bornée (et N autres)', /et 4 autres/.test(big.desc), big.desc);
    // un seul type présent ne doit pas produire de ligne vide pour l'autre
    const only = buildLootDiscordSummary({ 'jackpot Anneau X': 1 }, 'X');
    assert('Récap butin : aucune ligne "équipements" si aucun équipement', !only.desc.includes('équipement'), only.desc);
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
  // "il manque sphère et dague" (2026-07-23) -- ceinture + dague au fourreau ajoutées à
  // witchBodyOn, mais SEULEMENT si EQUIP.secondary est équipé (le slot secondary est bien une
  // dague en jeu, voir GEAR_TIERS[].sets.secondary "Dague Naru/Tuvala/Yuria/Grunil") -- même
  // logique que les orbes d'éveil déjà conditionnées par EQUIP.awakening juste en dessous dans
  // le fichier. Garde-fou : la dague ne doit JAMAIS s'afficher sans arme secondaire équipée.
  function testDaggerRendersOnlyWhenSecondaryEquipped() {
    if (typeof witchBodyOn === 'undefined' || typeof GEAR_TIERS === 'undefined' || typeof document === 'undefined') return;
    const canvas = document.createElement('canvas'); canvas.width = 100; canvas.height = 100;
    const g = canvas.getContext('2d'); if (!g) return;
    const savedEquip = { ...EQUIP };
    const tier = GEAR_TIERS.find(t => t.grade === 'blue') || GEAR_TIERS[GEAR_TIERS.length-1];
    function render(withSecondary) {
      Object.keys(EQUIP).forEach(k => delete EQUIP[k]);
      EQUIP.weapon = { color: tier.color, kind:'gear' };
      if (withSecondary) EQUIP.secondary = { color: tier.color, kind:'gear' };
      g.clearRect(0,0,100,100);
      g.save(); g.translate(35,70);
      witchBodyOn(g, 0, false);
      g.restore();
      return g.getImageData(0,0,100,100).data;
    }
    const withDagger = render(true);
    const withoutDagger = render(false);
    Object.keys(EQUIP).forEach(k => delete EQUIP[k]);
    Object.assign(EQUIP, savedEquip);
    let diffCount = 0;
    for (let i=0;i<withDagger.length;i+=4) {
      const d = Math.abs(withDagger[i]-withoutDagger[i])+Math.abs(withDagger[i+1]-withoutDagger[i+1])+Math.abs(withDagger[i+2]-withoutDagger[i+2]);
      if (d>10) diffCount++;
    }
    assert('La ceinture/dague ajoute des pixels visibles quand EQUIP.secondary est équipé', diffCount > 20, `diffCount=${diffCount}`);
  }
  // "dans le style plus détaillé" (2026-07-23) -- drawWolfIso enrichi (touffes de crinière,
  // collerette, pattes, texture de fourrure, contour) ajoute plusieurs boucles forEach/formes en
  // plus de l'original -- garde-fou : ne doit jamais lever d'exception, quels que soient l'échelle,
  // l'état de charge (lunge) ou le sens (facingRight), y compris aux valeurs limites (scale=0,
  // lunge=1, loin hors écran -> sortie anticipée avant même de dessiner).
  function testDrawWolfIsoNeverThrows() {
    if (typeof drawWolfIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [0, 0.85, 1.5].forEach(scale => {
        [0, 0.5, 1].forEach(lunge => {
          [-1, 1].forEach(px => {
            P.x = px;
            drawWolfIso(0, 0, { scale, lunge, phase: 0, tone:'#8a7050' }, 0.3);
          });
        });
      });
      drawWolfIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#8a7050' }, 0); // hors écran -> sortie anticipée
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawWolfIso ne lève jamais d\'exception (échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  // "dans le style plus détaillé", ambiance de référence (2026-07-23) -- drawProttyIso enrichi
  // (halo permanent, mouchetures bioluminescentes, tentacules, aile de mite avec tache) ajoute des
  // formes/boucles en plus de l'original. Même garde-fou que le loup : ne doit jamais lever
  // d'exception, quels que soient l'échelle, l'état de charge (lunge) ou le sens.
  function testDrawProttyIsoNeverThrows() {
    if (typeof drawProttyIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [0, 0.85, 1.5].forEach(scale => {
        [0, 0.5, 1].forEach(lunge => {
          [-1, 1].forEach(px => {
            P.x = px;
            drawProttyIso(0, 0, { scale, lunge, phase: 0, tone:'#a5543c' }, 0.3);
          });
        });
      });
      drawProttyIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#a5543c' }, 0); // hors écran -> sortie anticipée
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawProttyIso ne lève jamais d\'exception (échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  // Révision silhouette pirate approuvée après 3 tours de mockup (2026-07-13, Meshy) --
  // drawPirateIso enrichi (épaulières arrondies, bas de gilet déchiqueté, boutons, ceinture/boucle,
  // biceps, coutelas large, barbe carrée, boucle d'oreille, bandana à noeud + pan 2 segments, bottes
  // à revers, patches sur le pantalon) ajoute de nombreuses formes en plus de l'original. Même
  // garde-fou que le loup/Protty : ne doit jamais lever d'exception, quels que soient l'échelle,
  // l'état de charge (lunge) ou le sens (facingRight), y compris aux valeurs limites (scale=0,
  // lunge=1, loin hors écran -> sortie anticipée avant même de dessiner).
  function testDrawPirateIsoNeverThrows() {
    if (typeof drawPirateIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [0, 0.85, 1.5].forEach(scale => {
        [0, 0.5, 1].forEach(lunge => {
          [-1, 1].forEach(px => {
            P.x = px;
            drawPirateIso(0, 0, { scale, lunge, phase: 0, tone:'#7a6248' }, 0.3);
          });
        });
      });
      drawPirateIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#7a6248' }, 0); // hors écran -> sortie anticipée
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawPirateIso ne lève jamais d\'exception (échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  // Révision "B1" du Rhutum (2026-07-23, approuvée via maquette) : bras musclés, bourrelet de
  // ventre, pagne déchiqueté, collier d'os, marques de peinture de guerre ajoutés en plus de
  // l'original. Même garde-fou que le loup/Protty/pirate : ne doit jamais lever d'exception, quels
  // que soient l'échelle, l'état de charge (lunge) ou le sens.
  function testDrawRhutumIsoNeverThrows() {
    if (typeof drawRhutumIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [0, 0.85, 1.5].forEach(scale => {
        [0, 0.5, 1].forEach(lunge => {
          [-1, 1].forEach(px => {
            P.x = px;
            drawRhutumIso(0, 0, { scale, lunge, phase: 0, tone:'#7a6248' }, 0.3);
          });
        });
      });
      drawRhutumIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#7a6248' }, 0); // hors écran -> sortie anticipée
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawRhutumIso ne lève jamais d\'exception (échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  // Garde protège contre tout retour d'exception après la révision "Option C — héraldique"
  // (2026-07-23) : ajout d'une cape, d'un emblème doré et d'une ceinture/pochette au Garde Shultz.
  function testDrawShultzIsoNeverThrows() {
    if (typeof drawShultzIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [0, 0.85, 1.5].forEach(scale => {
        [0, 0.5, 1].forEach(lunge => {
          [-1, 1].forEach(px => {
            P.x = px;
            drawShultzIso(0, 0, { scale, lunge, phase: 0, tone:'#8a8578' }, 0.3);
          });
        });
      });
      drawShultzIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#8a8578' }, 0); // hors écran -> sortie anticipée
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawShultzIso ne lève jamais d\'exception (échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  // Garde protège contre tout retour d'exception après la révision "Option C" du Guerrier Sausan
  // (2026-07-23) : ajout d'un gantelet, d'une ceinture large à boucle dorée et de bottes.
  function testDrawSausanIsoNeverThrows() {
    if (typeof drawSausanIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [0, 0.85, 1.5].forEach(scale => {
        [0, 0.5, 1].forEach(lunge => {
          [-1, 1].forEach(px => {
            P.x = px;
            drawSausanIso(0, 0, { scale, lunge, phase: 0, tone:'#8a7a55' }, 0.3);
          });
        });
      });
      drawSausanIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#8a7a55' }, 0); // hors écran -> sortie anticipée
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawSausanIso ne lève jamais d\'exception (échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  // Garde protège contre tout retour d'exception après la révision "Mix2" du Mineur (2026-07-23) :
  // fissures de lave, bottes, 2e épaulière cloutée, gantelet, fente d'oeil lumineuse, masse agrandie
  // à 6 pointes -- uniquement sur la branche w.alpha (contremaître). alpha:false (mineur normal) doit
  // rester inchangé, donc testé aussi ici pour ne jamais laisser une régression croiser les branches.
  function testDrawMineurIsoNeverThrows() {
    if (typeof drawMineurIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [true, false].forEach(alpha => {
        [0, 0.85, 1.5].forEach(scale => {
          [0, 0.5, 1].forEach(lunge => {
            [-1, 1].forEach(px => {
              P.x = px;
              drawMineurIso(0, 0, { scale, lunge, phase: 0, tone:'#5a5850', alpha }, 0.3);
            });
          });
        });
      });
      drawMineurIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#5a5850', alpha:true }, 0); // hors écran -> sortie anticipée
      drawMineurIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#5a5850', alpha:false }, 0); // idem, branche normale
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawMineurIso ne lève jamais d\'exception (alpha/normal, échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  // Garde protège contre tout retour d'exception pour le Soldat Helm (zone "Poste Helm", zone 7) --
  // ajouté le 2026-07-13 pour corriger le bug où zoneIdx 7 tombait dans le fallback drawWolfIso
  // générique (loup affiché à tort dans une zone où il ne devrait plus apparaître). Teste les 2
  // branches (alpha:false = Soldat Helm humanoïde, alpha:true = "Golem" à silhouette radicalement
  // différente sans membres/tête) pour ne jamais laisser une régression croiser les branches.
  function testDrawHelmIsoNeverThrows() {
    if (typeof drawHelmIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [true, false].forEach(alpha => {
        [0, 0.85, 1.5].forEach(scale => {
          [0, 0.5, 1].forEach(lunge => {
            [-1, 1].forEach(px => {
              P.x = px;
              drawHelmIso(0, 0, { scale, lunge, phase: 0, tone:'#6a5a80', alpha }, 0.3);
            });
          });
        });
      });
      drawHelmIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#6a5a80', alpha:true }, 0); // hors écran -> sortie anticipée
      drawHelmIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#6a5a80', alpha:false }, 0); // idem, branche normale
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawHelmIso ne lève jamais d\'exception (alpha/normal, échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  // Garde protège contre tout retour d'exception pour le Bandit Gahaz (zone "Repaire Bandits
  // Gahaz", zone 8) -- ajouté le 2026-07-13 pour corriger le bug où zoneIdx 8 tombait dans le
  // fallback drawWolfIso générique (loup affiché à tort). Contrairement à Mineur/Helm, ce monstre
  // n'a pas de variante w.alpha dédiée (le scale générique suffit) -- on teste quand même les 2
  // valeurs d'alpha pour garantir qu'aucune branche future n'y introduit une régression.
  function testDrawGahazIsoNeverThrows() {
    if (typeof drawGahazIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [true, false].forEach(alpha => {
        [0, 0.85, 1.5].forEach(scale => {
          [0, 0.5, 1].forEach(lunge => {
            [-1, 1].forEach(px => {
              // teleportChargeT (2026-07-13, boss de zone Gahaz) : 0 (repos), en cours de charge,
              // et à son max (GAHAZ_TELEPORT_CHARGE_T) -- couvre la lueur additive ajoutée dans
              // drawGahazIso sans jamais dépendre de son existence (fallback .6 si la constante
              // n'est pas encore chargée, même esprit défensif que le reste de ce test).
              [0, .3, (typeof GAHAZ_TELEPORT_CHARGE_T !== 'undefined' ? GAHAZ_TELEPORT_CHARGE_T : .6)].forEach(teleportChargeT => {
                P.x = px;
                drawGahazIso(0, 0, { scale, lunge, phase: 0, tone:'#607a45', alpha, teleportChargeT }, 0.3);
              });
            });
          });
        });
      });
      drawGahazIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#607a45', alpha:true, teleportChargeT:.5 }, 0); // hors écran -> sortie anticipée
      drawGahazIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#607a45', alpha:false, teleportChargeT:0 }, 0); // idem, branche normale
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawGahazIso ne lève jamais d\'exception (échelle/charge/sens/hors-écran, alpha + teleportChargeT inclus)', !threw, errMsg);
  }
  // Garde protège contre tout retour d'exception pour le Sectateur d'Elric (zone "Sanctuaire
  // Elric", zone 9) -- ajouté le 2026-07-13 pour corriger le bug où zoneIdx 9 tombait dans le
  // fallback drawWolfIso générique (loup affiché à tort). Contrairement à Gahaz, ce monstre A une
  // variante w.alpha dédiée ("idole vivante") -- même exigence de couverture que
  // testDrawHelmIsoNeverThrows (les 2 branches alpha/normal doivent être exercées).
  function testDrawElricIsoNeverThrows() {
    if (typeof drawElricIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [true, false].forEach(alpha => {
        [0, 0.85, 1.5].forEach(scale => {
          [0, 0.5, 1].forEach(lunge => {
            [-1, 1].forEach(px => {
              P.x = px;
              drawElricIso(0, 0, { scale, lunge, phase: 0, tone:'#7a6a9a', alpha }, 0.3);
            });
          });
        });
      });
      drawElricIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#7a6a9a', alpha:true }, 0); // hors écran -> sortie anticipée
      drawElricIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#7a6a9a', alpha:false }, 0); // idem, branche normale
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawElricIso ne lève jamais d\'exception (alpha/normal, échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  // Garde protège contre tout retour d'exception pour l'Uluan (zone "Ruines de Kratuga", zone 10)
  // -- ajouté le 2026-07-13 pour corriger le bug où zoneIdx 10 tombait dans le fallback
  // drawWolfIso générique (loup affiché à tort). Comme Gahaz/Sausan/Rhutum/Shultz/Pirate, ce
  // monstre n'a PAS de variante w.alpha dédiée (le w.scale déjà plus grand pour un pack alpha
  // suffit) -- w.alpha est quand même exercé true/false ci-dessous par cohérence avec les autres
  // gardes de ce fichier, même si la fonction ne s'y branche pas.
  function testDrawUluanIsoNeverThrows() {
    if (typeof drawUluanIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [true, false].forEach(alpha => {
        [0, 0.85, 1.5].forEach(scale => {
          [0, 0.5, 1].forEach(lunge => {
            [-1, 1].forEach(px => {
              P.x = px;
              drawUluanIso(0, 0, { scale, lunge, phase: 0, tone:'#b09060', alpha }, 0.3);
            });
          });
        });
      });
      drawUluanIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#b09060', alpha:true }, 0); // hors écran -> sortie anticipée
      drawUluanIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#b09060', alpha:false }, 0); // idem
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawUluanIso ne lève jamais d\'exception (alpha/normal, échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  // Garde protège contre tout retour d'exception pour l'Esprit des Mânes (zone "Planque des
  // Mânes", zone 11) -- ajouté le 2026-07-13 pour corriger le bug où zoneIdx 11 tombait dans le
  // fallback drawWolfIso générique (loup affiché à tort). Contrairement à Uluan/Gahaz/Sausan/
  // Rhutum/Shultz/Pirate, ce monstre A une vraie variante w.alpha dédiée (brute spectrale
  // bouffie au fléau fumant, mockup "Mix B") distincte du mob normal (archer/lancier spectral
  // svelte, mockup "Mix C") -- les deux branches sont donc exercées ici comme pour
  // drawElricIso/drawHelmIso/drawMineurIso.
  function testDrawManesIsoNeverThrows() {
    if (typeof drawManesIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [true, false].forEach(alpha => {
        [0, 0.85, 1.5].forEach(scale => {
          [0, 0.5, 1].forEach(lunge => {
            [-1, 1].forEach(px => {
              P.x = px;
              drawManesIso(0, 0, { scale, lunge, phase: 0, tone:'#8a9ab0', alpha }, 0.3);
            });
          });
        });
      });
      drawManesIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#8a9ab0', alpha:true }, 0); // hors écran -> sortie anticipée
      drawManesIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#8a9ab0', alpha:false }, 0); // idem, branche normale
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawManesIso ne lève jamais d\'exception (alpha/normal, échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  function testDrawTrollIsoNeverThrows() {
    if (typeof drawTrollIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [true, false].forEach(alpha => {
        [0, 0.85, 1.5].forEach(scale => {
          [0, 0.5, 1].forEach(lunge => {
            [-1, 1].forEach(px => {
              P.x = px;
              drawTrollIso(0, 0, { scale, lunge, phase: 0, tone:'#6a7a5e', alpha }, 0.3);
            });
          });
        });
      });
      drawTrollIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#6a7a5e', alpha:true }, 0); // hors écran -> sortie anticipée
      drawTrollIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#6a7a5e', alpha:false }, 0); // idem, branche normale
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawTrollIso ne lève jamais d\'exception (alpha/normal, échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  // Zone 14 "Base de Bashim" (Soldat de Bashim, avec sa variante boss "Kurd") — même garde-fou que
  // les autres draw*Iso : jamais d'exception quelle que soit la combinaison alpha/échelle/charge/
  // sens/hors-écran (voir testDrawTrollIsoNeverThrows/testDrawElricIsoNeverThrows, même pattern).
  function testDrawBashimIsoNeverThrows() {
    if (typeof drawBashimIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [true, false].forEach(alpha => {
        [0, 0.85, 1.5].forEach(scale => {
          [0, 0.5, 1].forEach(lunge => {
            [-1, 1].forEach(px => {
              P.x = px;
              drawBashimIso(0, 0, { scale, lunge, phase: 0, tone:'#8a8a68', alpha }, 0.3);
            });
          });
        });
      });
      drawBashimIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#8a8a68', alpha:true }, 0); // hors écran -> sortie anticipée
      drawBashimIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#8a8a68', alpha:false }, 0); // idem, branche normale
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawBashimIso ne lève jamais d\'exception (alpha/normal, échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  function testDrawIliyaIsoNeverThrows() {
    if (typeof drawIliyaIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [true, false].forEach(alpha => {
        [0, 0.85, 1.5].forEach(scale => {
          [0, 0.5, 1].forEach(lunge => {
            [-1, 1].forEach(px => {
              P.x = px;
              drawIliyaIso(0, 0, { scale, lunge, phase: 0, tone:'#4a9a9a', alpha }, 0.3);
            });
          });
        });
      });
      drawIliyaIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#4a9a9a', alpha:true }, 0); // hors écran -> sortie anticipée
      drawIliyaIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#4a9a9a', alpha:false }, 0); // idem
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawIliyaIso ne lève jamais d\'exception (alpha/normal, échelle/charge/sens/hors-écran)', !threw, errMsg);
  }
  // Troll de Polly (zone 15, "Forêt de Polly", DERNIÈRE zone sans modèle dédié -- désormais couverte)
  function testDrawPollyTrollIsoNeverThrows() {
    if (typeof drawPollyTrollIso === 'undefined' || typeof cam === 'undefined' || typeof P === 'undefined') return;
    const savedCamX = cam.x, savedCamY = cam.y, savedPx = P.x, savedPy = P.y;
    cam.x = 0; cam.y = 0; P.x = 100; P.y = 0;
    let threw = false, errMsg = '';
    try {
      [true, false].forEach(alpha => {
        [0, 0.85, 1.5].forEach(scale => {
          [0, 0.5, 1].forEach(lunge => {
            [-1, 1].forEach(px => {
              P.x = px;
              drawPollyTrollIso(0, 0, { scale, lunge, phase: 0, tone:'#3f6e50', alpha }, 0.3);
            });
          });
        });
      });
      drawPollyTrollIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#3f6e50', alpha:true }, 0); // hors écran -> sortie anticipée
      drawPollyTrollIso(99999, 99999, { scale:1, lunge:0, phase:0, tone:'#3f6e50', alpha:false }, 0); // idem
    } catch (e) { threw = true; errMsg = e.message; }
    cam.x = savedCamX; cam.y = savedCamY; P.x = savedPx; P.y = savedPy;
    assert('drawPollyTrollIso ne lève jamais d\'exception (alpha/normal, échelle/charge/sens/hors-écran)', !threw, errMsg);
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
  // 2026-07-13 : réécrit pour la fenêtre glissante 3 min (silverRateBuffer/computeSlidingSilverPerHour,
  // voir game-core.js) -- bestSilverPerHour ne dérive plus de tokenGain/(minutes de session ENTIÈRE)
  // mais du buffer d'échantillons horodatés ; ce test peuple donc silverRateBuffer directement
  // plutôt que S.tokenSilverEarned. Le rythme "plus élevé" simulé reste dans les 30% du record
  // (garde-fou anti-pic, voir testComputeSlidingSilverPerHourIgnoresIsolatedSpikeForRecord pour le
  // cas où un pic dépasse ce seuil et est ignoré).
  function testBestSilverPerHourNeverDecreasesAndRequiresTwoMinutes() {
    const s = { bestSilverPerHour: S.bestSilverPerHour, tokenSilverEarned: S.tokenSilverEarned,
      tokenSilverEarnedAtLoad: S.tokenSilverEarnedAtLoad, startTime: S.startTime };
    const savedBuffer = silverRateBuffer;
    try {
      // simule une session de 30s avec un gros gain -> ne doit PAS mettre à jour le record (mins<2),
      // même si le buffer contiendrait de quoi extrapoler un pic énorme (le garde-fou "2 minutes"
      // bloque AVANT même de lire le buffer)
      S.bestSilverPerHour = 1000;
      S.startTime = performance.now() - 30*1000;
      silverRateBuffer = [{ t: Date.now()-20000, silver: 50000 }];
      hud();
      assert('Un gros gain sur <2min de session ne modifie PAS le record (protège contre les pics)',
        S.bestSilverPerHour === 1000, `bestSilverPerHour=${S.bestSilverPerHour}`);
      // simule une session de 3 min avec un rythme réellement plus élevé, RÉPARTI sur toute la
      // fenêtre glissante (pas un pic isolé) -> le record doit monter (~+10%, sous le seuil
      // anti-pic de 30%)
      S.startTime = performance.now() - 3*60*1000;
      const now = Date.now();
      const targetRate = 1100; // record actuel (1000) +10%
      const totalOverWindow = targetRate * (SILVER_RATE_WINDOW_MS/3600000);
      silverRateBuffer = [];
      for (let i=0;i<6;i++) silverRateBuffer.push({ t: now - SILVER_RATE_WINDOW_MS + i*(SILVER_RATE_WINDOW_MS/6) + 1000, silver: totalOverWindow/6 });
      hud();
      assert('Un rythme soutenu (progressif, pas un pic) sur >2min de session met bien à jour le record (record monte)',
        S.bestSilverPerHour > 1000, `bestSilverPerHour=${S.bestSilverPerHour}`);
      const afterFirstUpdate = S.bestSilverPerHour;
      // un rythme plus FAIBLE ensuite ne doit jamais faire REDESCENDRE le record (monotone)
      silverRateBuffer = [{ t: now-10000, silver: 10 }];
      S.startTime = performance.now() - 3*60*1000;
      hud();
      assert('Le record ne redescend jamais (monotone, comme bestKpm)', S.bestSilverPerHour === afterFirstUpdate,
        `avant=${afterFirstUpdate} apres=${S.bestSilverPerHour}`);
    } finally {
      S.bestSilverPerHour = s.bestSilverPerHour; S.tokenSilverEarned = s.tokenSilverEarned;
      S.tokenSilverEarnedAtLoad = s.tokenSilverEarnedAtLoad; S.startTime = s.startTime;
      silverRateBuffer = savedBuffer;
    }
  }
  // fonction PURE computeSlidingSilverPerHour() (voir game-core.js, remplace le calcul session-
  // entière par une fenêtre glissante 3 min + garde-fou anti-pic 30%) -- testée indépendamment du
  // tick réel du jeu, buffer/now/currentBest en entrée directe.
  function testComputeSlidingSilverPerHourStableRateWithinWindow() {
    if (typeof computeSlidingSilverPerHour !== 'function') return;
    const now = Date.now();
    const buffer = [ { t: now-170000, silver:1000 }, { t: now-90000, silver:1000 }, { t: now-10000, silver:1000 } ];
    const { ratePerHour, eligible } = computeSlidingSilverPerHour(buffer, now, 0);
    assert('Taux calculé sur la fenêtre glissante à partir de gains réguliers (pas de gain hors-fenêtre)',
      ratePerHour > 50000 && ratePerHour < 90000, `rate=${ratePerHour}`);
    assert('Éligible au record en l\'absence de record préexistant (currentBest=0)', eligible === true);
  }
  function testComputeSlidingSilverPerHourIgnoresIsolatedSpikeForRecord() {
    if (typeof computeSlidingSilverPerHour !== 'function') return;
    const now = Date.now();
    const currentBest = 60000;
    // pic à +50% mais RÉPARTI sur un étalement suffisant (>=90s, SILVER_RATE_MIN_SPAN_MS) pour
    // isoler spécifiquement le garde-fou anti-pic 30% (pas le garde-fou "bourrasque trop courte"
    // ci-dessous, testé séparément) -- sinon ce test ne prouverait plus rien sur la déviation.
    const targetRate = currentBest * 1.5;
    const span = 100000; // 100s, > SILVER_RATE_MIN_SPAN_MS (90s)
    const totalOverSpan = targetRate * (span/3600000);
    const buffer = [ { t: now-span, silver: totalOverSpan*0.5 }, { t: now-1000, silver: totalOverSpan*0.5 } ];
    const { ratePerHour, eligible } = computeSlidingSilverPerHour(buffer, now, currentBest);
    assert('Le pic calcule bien un taux nettement au-dessus du record (+~50%)', ratePerHour > currentBest*1.3, `rate=${ratePerHour}`);
    assert('Le pic n\'est PAS éligible au nouveau record (écart >30% avec la moyenne déjà établie)', eligible === false);
  }
  function testComputeSlidingSilverPerHourRejectsShortBurstRightAfterConnection() {
    // bug réel corrigé le 2026-07-13 (retour utilisateur : "pas des moyenne seulement au
    // connexion quand y'a beaucoup de mob") : silverRateBuffer est transitoire (vidé au reload),
    // donc juste après une reconnexion une bourrasque de kills sur quelques secondes (zone dense)
    // extrapolait un taux énorme -- ET échappait au garde-fou anti-pic si currentBest valait
    // encore 0 (aucun record établi, cas trivial "toujours éligible"). Le nouveau garde-fou
    // SILVER_RATE_MIN_SPAN_MS doit rejeter ce cas MÊME à currentBest=0.
    if (typeof computeSlidingSilverPerHour !== 'function') return;
    const now = Date.now();
    // 5s de bourrasque, silver raisonnable sur 5s mais qui donnerait un taux astronomique extrapolé sur 1h
    const buffer = [ { t: now-5000, silver: 200 } ];
    const { eligible: eligibleNoRecord } = computeSlidingSilverPerHour(buffer, now, 0);
    assert('Bourrasque de 5s : PAS éligible au record même sans record préexistant (currentBest=0)', eligibleNoRecord === false);
    const { eligible: eligibleWithRecord } = computeSlidingSilverPerHour(buffer, now, 60000);
    assert('Bourrasque de 5s : PAS éligible non plus avec un record déjà établi', eligibleWithRecord === false);
    // un étalement pile au-dessus du seuil (SILVER_RATE_MIN_SPAN_MS) redevient éligible (si le
    // taux lui-même reste raisonnable) -- vérifie que le garde-fou est bien un SEUIL, pas un blocage total
    const okBuffer = [ { t: now-(SILVER_RATE_MIN_SPAN_MS+5000), silver: 50 }, { t: now-1000, silver: 50 } ];
    const { eligible: eligibleLongEnough } = computeSlidingSilverPerHour(okBuffer, now, 0);
    assert('Un étalement au-dessus du seuil minimum redevient éligible', eligibleLongEnough === true);
  }
  function testComputeSlidingSilverPerHourAcceptsProgressiveIncreaseAsRecord() {
    if (typeof computeSlidingSilverPerHour !== 'function') return;
    const now = Date.now();
    const currentBest = 60000;
    // hausse progressive (+20%, sous le seuil de 30%) répartie sur TOUTE la fenêtre, pas un pic
    const targetRate = currentBest * 1.2;
    const totalOverWindow = targetRate * (SILVER_RATE_WINDOW_MS/3600000);
    const buffer = [];
    for (let i=0;i<6;i++) buffer.push({ t: now - SILVER_RATE_WINDOW_MS + i*(SILVER_RATE_WINDOW_MS/6) + 1000, silver: totalOverWindow/6 });
    const { ratePerHour, eligible } = computeSlidingSilverPerHour(buffer, now, currentBest);
    assert('Taux calculé proche de +20% du record actuel', Math.abs(ratePerHour - targetRate)/targetRate < 0.15, `rate=${ratePerHour}, target=${targetRate}`);
    assert('Une hausse progressive sous le seuil anti-pic (30%) devient bien éligible au nouveau record', eligible === true);
  }
  // même fenêtre glissante que computeSlidingSilverPerHour, version kills/min (2026-07-13,
  // demande explicite : "pareil sur 3 minutes avec 30% de variation max"). Voir computeSlidingKpm.
  function testComputeSlidingKpmStableRateWithinWindow() {
    if (typeof computeSlidingKpm !== 'function') return;
    const now = Date.now();
    const buffer = [ { t: now-170000, kills:5 }, { t: now-90000, kills:5 }, { t: now-10000, kills:5 } ];
    const { ratePerMin, eligible } = computeSlidingKpm(buffer, now, 0);
    assert('Taux kpm calculé sur la fenêtre glissante à partir de kills réguliers', ratePerMin > 4 && ratePerMin < 6, `rate=${ratePerMin}`);
    assert('Éligible au record en l\'absence de record préexistant (currentBest=0)', eligible === true);
  }
  function testComputeSlidingKpmIgnoresIsolatedSpikeForRecord() {
    if (typeof computeSlidingKpm !== 'function') return;
    const now = Date.now();
    const currentBest = 10;
    const targetRate = currentBest * 1.5;
    const span = 100000; // 100s, > KPM_RATE_MIN_SPAN_MS (90s)
    const totalOverSpan = targetRate * (span/60000);
    const buffer = [ { t: now-span, kills: totalOverSpan*0.5 }, { t: now-1000, kills: totalOverSpan*0.5 } ];
    const { ratePerMin, eligible } = computeSlidingKpm(buffer, now, currentBest);
    assert('Le pic calcule bien un taux nettement au-dessus du record (+~50%)', ratePerMin > currentBest*1.3, `rate=${ratePerMin}`);
    assert('Le pic n\'est PAS éligible au nouveau record (écart >30% avec la moyenne déjà établie)', eligible === false);
  }
  function testComputeSlidingKpmRejectsShortBurstRightAfterConnection() {
    // même bug que silver/h (kpmRateBuffer transitoire, vidé au reload) : une bourrasque de kills
    // sur quelques secondes juste après une reconnexion (zone dense en mobs) ne doit JAMAIS pouvoir
    // devenir le record, peu importe currentBest.
    if (typeof computeSlidingKpm !== 'function') return;
    const now = Date.now();
    const buffer = [ { t: now-5000, kills: 10 } ]; // 10 kills en 5s -> énorme si extrapolé sur 1 min
    const { eligible: eligibleNoRecord } = computeSlidingKpm(buffer, now, 0);
    assert('Bourrasque de 5s : PAS éligible au record même sans record préexistant (currentBest=0)', eligibleNoRecord === false);
    const { eligible: eligibleWithRecord } = computeSlidingKpm(buffer, now, 10);
    assert('Bourrasque de 5s : PAS éligible non plus avec un record déjà établi', eligibleWithRecord === false);
    const okBuffer = [ { t: now-(KPM_RATE_MIN_SPAN_MS+5000), kills: 3 }, { t: now-1000, kills: 3 } ];
    const { eligible: eligibleLongEnough } = computeSlidingKpm(okBuffer, now, 0);
    assert('Un étalement au-dessus du seuil minimum redevient éligible', eligibleLongEnough === true);
  }
  function testComputeSlidingKpmAcceptsProgressiveIncreaseAsRecord() {
    if (typeof computeSlidingKpm !== 'function') return;
    const now = Date.now();
    const currentBest = 10;
    const targetRate = currentBest * 1.2; // +20%, sous le seuil de 30%
    const totalOverWindow = targetRate * (KPM_RATE_WINDOW_MS/60000);
    const buffer = [];
    for (let i=0;i<6;i++) buffer.push({ t: now - KPM_RATE_WINDOW_MS + i*(KPM_RATE_WINDOW_MS/6) + 1000, kills: totalOverWindow/6 });
    const { ratePerMin, eligible } = computeSlidingKpm(buffer, now, currentBest);
    assert('Taux calculé proche de +20% du record actuel', Math.abs(ratePerMin - targetRate)/targetRate < 0.15, `rate=${ratePerMin}, target=${targetRate}`);
    assert('Une hausse progressive sous le seuil anti-pic (30%) devient bien éligible au nouveau record', eligible === true);
  }
  // même migration que testSilverPerHourResetV436ZeroesStaleRecord, version bestKpm (2026-07-13)
  function testBestKpmResetV439ZeroesStaleRecord() {
    if (typeof migrateBestKpmResetV439 !== 'function') return;
    const before = S.bestKpm;
    S.bestKpm = 999999; // vieux record potentiellement gonflé par le bug corrigé
    migrateBestKpmResetV439();
    assert('Reset V439 : bestKpm remis à 0, quelle que soit sa valeur précédente', S.bestKpm === 0, `got=${S.bestKpm}`);
    S.bestKpm = before;
  }
  // même fenêtre glissante que computeSlidingSilverPerHour/computeSlidingKpm, version xp/h (2026-07-13)
  function testComputeSlidingXpPerHourStableRateWithinWindow() {
    if (typeof computeSlidingXpPerHour !== 'function') return;
    const now = Date.now();
    const buffer = [ { t: now-170000, xp:500 }, { t: now-90000, xp:500 }, { t: now-10000, xp:500 } ];
    const { ratePerHour, eligible } = computeSlidingXpPerHour(buffer, now, 0);
    assert('Taux xp/h calculé sur la fenêtre glissante à partir de gains réguliers', ratePerHour > 0, `rate=${ratePerHour}`);
    assert('Éligible au record en l\'absence de record préexistant (currentBest=0)', eligible === true);
  }
  function testComputeSlidingXpPerHourIgnoresIsolatedSpikeForRecord() {
    if (typeof computeSlidingXpPerHour !== 'function') return;
    const now = Date.now();
    const currentBest = 10000;
    const targetRate = currentBest * 1.5;
    const span = 100000; // 100s, > XP_RATE_MIN_SPAN_MS (90s)
    const totalOverSpan = targetRate * (span/3600000);
    const buffer = [ { t: now-span, xp: totalOverSpan*0.5 }, { t: now-1000, xp: totalOverSpan*0.5 } ];
    const { ratePerHour, eligible } = computeSlidingXpPerHour(buffer, now, currentBest);
    assert('Le pic calcule bien un taux nettement au-dessus du record (+~50%)', ratePerHour > currentBest*1.3, `rate=${ratePerHour}`);
    assert('Le pic n\'est PAS éligible au nouveau record (écart >30% avec la moyenne déjà établie)', eligible === false);
  }
  function testComputeSlidingXpPerHourRejectsShortBurstRightAfterConnection() {
    if (typeof computeSlidingXpPerHour !== 'function') return;
    const now = Date.now();
    const buffer = [ { t: now-5000, xp: 50000 } ]; // gros pack XP en 5s -> énorme si extrapolé sur 1h
    const { eligible: eligibleNoRecord } = computeSlidingXpPerHour(buffer, now, 0);
    assert('Bourrasque de 5s : PAS éligible au record même sans record préexistant (currentBest=0)', eligibleNoRecord === false);
    const { eligible: eligibleWithRecord } = computeSlidingXpPerHour(buffer, now, 10000);
    assert('Bourrasque de 5s : PAS éligible non plus avec un record déjà établi', eligibleWithRecord === false);
    const okBuffer = [ { t: now-(XP_RATE_MIN_SPAN_MS+5000), xp: 3000 }, { t: now-1000, xp: 3000 } ];
    const { eligible: eligibleLongEnough } = computeSlidingXpPerHour(okBuffer, now, 0);
    assert('Un étalement au-dessus du seuil minimum redevient éligible', eligibleLongEnough === true);
  }
  function testComputeSlidingXpPerHourAcceptsProgressiveIncreaseAsRecord() {
    if (typeof computeSlidingXpPerHour !== 'function') return;
    const now = Date.now();
    const currentBest = 10000;
    const targetRate = currentBest * 1.2; // +20%, sous le seuil de 30%
    const totalOverWindow = targetRate * (XP_RATE_WINDOW_MS/3600000);
    const buffer = [];
    for (let i=0;i<6;i++) buffer.push({ t: now - XP_RATE_WINDOW_MS + i*(XP_RATE_WINDOW_MS/6) + 1000, xp: totalOverWindow/6 });
    const { ratePerHour, eligible } = computeSlidingXpPerHour(buffer, now, currentBest);
    assert('Taux calculé proche de +20% du record actuel', Math.abs(ratePerHour - targetRate)/targetRate < 0.15, `rate=${ratePerHour}, target=${targetRate}`);
    assert('Une hausse progressive sous le seuil anti-pic (30%) devient bien éligible au nouveau record', eligible === true);
  }
  // garde-fou de dérive i18n (2026-07-16, retour utilisateur : "il y a encore des traductions
  // anglais/français pas faites") : audit des données vs NAME_EN, 38 noms (tout le stuff
  // Naru/Tuvala/Yuria/Grunil, les pierres de palier, Cron, le Trésor de Velia, le Livre interdit)
  // n'avaient AUCUNE entrée -- tr() les laissait en français en mode EN partout. Ce test fige la
  // règle : TOUT nom affichable défini dans les données (stuff, matériau, zone, mob, loot,
  // objets Mini Boss, liste blanche du marché) doit avoir une entrée NAME_EN (identité acceptée
  // pour les noms déjà anglais, ex "Orkinrad's Belt").
  function testDisplayNamesAllHaveNameEnEntry() {
    if (typeof NAME_EN === 'undefined') return;
    const missing = new Set();
    const need = n => { if (n && !(n in NAME_EN)) missing.add(n); };
    (typeof GEAR_TIERS !== 'undefined' ? GEAR_TIERS : []).forEach(t => {
      Object.values(t.sets || {}).forEach(need);
      if (t.material) need(t.material.name);
    });
    (typeof ZONES !== 'undefined' ? ZONES : []).forEach(z => {
      need(z.name); need(z.mob);
      Object.values(z.loot || {}).forEach(v => { if (v && typeof v === 'object' && v.name) need(v.name); });
    });
    (typeof MARKET_MATERIALS !== 'undefined' ? MARKET_MATERIALS : []).forEach(m => need(m.name));
    if (typeof MINIBOSS_FORBIDDEN_BOOK !== 'undefined') need(MINIBOSS_FORBIDDEN_BOOK.name);
    if (typeof MINIBOSS_PARCHEMIN !== 'undefined') need(MINIBOSS_PARCHEMIN.name);
    assert('Tout nom affichable des données (stuff/matériaux/zones/mobs/loot/marché/Mini Boss) a une entrée NAME_EN (mode anglais)',
      missing.size === 0, [...missing].join(', '));
  }
  // courrier : l'entrée 'loyalty' d'une VIEILLE sauvegarde gardait "Points de fidélité" pour
  // toujours (2026-07-16, retour utilisateur : "point de fidélité français aussi dans la mailbox")
  // -- l'objet a été renommé "Loyalties" en V~213 mais mailboxAdd() ne fusionnait que qty, jamais
  // le nom stocké. Double correctif : rendu canonique immédiat + rafraîchissement du nom à la fusion.
  function testMailboxLoyaltyEntryShowsCanonicalNameEvenFromOldSave() {
    if (typeof renderMailboxHtml !== 'function' || typeof mailboxAdd !== 'function') return;
    const savedMailbox = S.mailbox;
    try {
      // sauvegarde d'avant le renommage V~213 : l'ancien nom français est persisté
      S.mailbox = [{ key: 'loyalty', name: 'Points de fidélité', icon: '🏅', qty: 400 }];
      const html = renderMailboxHtml();
      assert('Le courrier affiche "Loyalties" même si la sauvegarde contient l\'ancien nom "Points de fidélité"',
        html.includes('Loyalties') && !html.includes('Points de fidélité'), html.slice(0, 300));
      mailboxAdd('loyalty', 'Loyalties', '🏅', 200);
      assert('mailboxAdd() fusionne la quantité ET rafraîchit le nom stocké (la donnée s\'auto-répare au prochain octroi)',
        S.mailbox[0].qty === 600 && S.mailbox[0].name === 'Loyalties', JSON.stringify(S.mailbox[0]));
    } finally {
      S.mailbox = savedMailbox;
    }
  }
  // ticker de loot : les noms passent par tr() à l'affichage (2026-07-16, même retour utilisateur --
  // le ticker montrait "Mousse de Polly" en mode EN alors que la carte Loot traduisait bien) ; la
  // clé de fusion ×N reste le nom BRUT (indépendant de la langue).
  function testLootTickerTranslatesNamesInEnglishMode() {
    if (typeof lootLine !== 'function' || typeof NAME_EN === 'undefined') return;
    const t = document.getElementById('lootTicker'); if (!t) return;
    const savedLang = LANG, savedEntry = lastLootEntry, savedHtml = t.innerHTML;
    try {
      LANG = 'en'; lastLootEntry = null;
      lootLine({ name: 'Mousse de Polly' }, 0, '');
      assert('lootLine() affiche le nom TRADUIT en mode EN (Polly Moss, pas Mousse de Polly)',
        t.lastChild && t.lastChild.textContent.includes('Polly Moss'), t.lastChild && t.lastChild.textContent);
      lootLine({ name: 'Mousse de Polly' }, 0, '');
      assert('lootLine() fusionne bien ×2 sur le nom brut malgré l\'affichage traduit',
        t.lastChild && t.lastChild.textContent.includes('×2'), t.lastChild && t.lastChild.textContent);
    } finally {
      LANG = savedLang; lastLootEntry = savedEntry; t.innerHTML = savedHtml;
    }
  }
  // "rattrapage de +9 milliards d'XP" (2026-07-14, bug signalé par un joueur) : gainXp() alimentait
  // xpRateBuffer pour TOUT appel, y compris le rattrapage hors-ligne lui-même (game-core.js,
  // applySaveState) -- un gros rattrapage gonflait donc bestXpPerHour, servant de taux au PROCHAIN
  // rattrapage, qui l'inflatait encore plus (boucle auto-amplifiée à chaque reconnexion espacée).
  // Corrigé par un 2e paramètre trackRate (défaut true, passé à false par le rattrapage) -- même
  // principe que le garde category==='loot' déjà en place sur addSilver()/silverRateBuffer.
  function testGainXpTrackRateFalseNeverFeedsXpRateBuffer() {
    if (typeof gainXp !== 'function' || typeof xpRateBuffer === 'undefined') return;
    const savedBuffer = xpRateBuffer;
    const savedXp = S.xp, savedLvl = S.lvl, savedXpNext = S.xpNext, savedXpEarned = S.xpEarned;
    try {
      xpRateBuffer = [];
      gainXp(1000000, false); // simule un gros rattrapage hors-ligne
      assert('gainXp(n, false) (rattrapage) n\'ajoute AUCUN échantillon à xpRateBuffer',
        xpRateBuffer.length === 0, `length=${xpRateBuffer.length}`);
      gainXp(50); // appel normal (gameplay), trackRate par défaut = true
      assert('gainXp(n) sans 2e argument (gameplay normal) alimente bien xpRateBuffer comme avant',
        xpRateBuffer.length === 1 && xpRateBuffer[0].xp === 50, `buffer=${JSON.stringify(xpRateBuffer)}`);
    } finally {
      xpRateBuffer = savedBuffer;
      S.xp = savedXp; S.lvl = savedLvl; S.xpNext = savedXpNext; S.xpEarned = savedXpEarned;
    }
  }
  // même migration que testBestKpmResetV439ZeroesStaleRecord, version bestXpPerHour (2026-07-13)
  function testBestXpPerHourResetV440ZeroesStaleRecord() {
    if (typeof migrateBestXpPerHourResetV440 !== 'function') return;
    const before = S.bestXpPerHour;
    S.bestXpPerHour = 999999999; // vieux record potentiellement gonflé par le bug corrigé
    migrateBestXpPerHourResetV440();
    assert('Reset V440 : bestXpPerHour remis à 0, quelle que soit sa valeur précédente', S.bestXpPerHour === 0, `got=${S.bestXpPerHour}`);
    S.bestXpPerHour = before;
  }
  // même garde-fou que testBestSilverPerHourNeverDecreasesAndRequiresTwoMinutes, version XP
  // (2026-07-13, même fenêtre glissante 3min + anti-pic 30% appliquée à bestXpPerHour) -- record
  // ne redescend jamais (monotone), et seulement après 2 min de session ET un étalement réel
  // d'échantillons >= XP_RATE_MIN_SPAN_MS (protège contre un pic extrapolé juste après reconnexion).
  function testBestXpPerHourNeverDecreasesAndRequiresTwoMinutes() {
    const s = { bestXpPerHour: S.bestXpPerHour, startTime: S.startTime };
    const savedBuffer = xpRateBuffer;
    try {
      // simule une session de 30s avec un gros gain -> ne doit PAS mettre à jour le record (mins<2)
      S.bestXpPerHour = 1000;
      S.startTime = performance.now() - 30*1000;
      xpRateBuffer = [{ t: Date.now()-20000, xp: 50000 }];
      hud();
      assert('Un gros gain XP sur <2min de session ne modifie PAS le record (protège contre les pics)',
        S.bestXpPerHour === 1000, `bestXpPerHour=${S.bestXpPerHour}`);
      // simule une session de 3 min avec un rythme réellement plus élevé, RÉPARTI sur toute la
      // fenêtre glissante (pas un pic isolé) -> le record doit monter (~+10%, sous le seuil anti-pic)
      S.startTime = performance.now() - 3*60*1000;
      const now = Date.now();
      const targetRate = 1100; // record actuel (1000) +10%
      const totalOverWindow = targetRate * (XP_RATE_WINDOW_MS/3600000);
      xpRateBuffer = [];
      for (let i=0;i<6;i++) xpRateBuffer.push({ t: now - XP_RATE_WINDOW_MS + i*(XP_RATE_WINDOW_MS/6) + 1000, xp: totalOverWindow/6 });
      hud();
      assert('Un rythme XP soutenu (progressif, pas un pic) sur >2min de session met bien à jour le record (record monte)',
        S.bestXpPerHour > 1000, `bestXpPerHour=${S.bestXpPerHour}`);
      const afterFirstUpdate = S.bestXpPerHour;
      // un rythme plus FAIBLE ensuite ne doit jamais faire REDESCENDRE le record (monotone)
      xpRateBuffer = [{ t: now-10000, xp: 10 }];
      S.startTime = performance.now() - 3*60*1000;
      hud();
      assert('Le record xp/h ne redescend jamais (monotone, comme bestSilverPerHour/bestKpm)', S.bestXpPerHour === afterFirstUpdate,
        `avant=${afterFirstUpdate} apres=${S.bestXpPerHour}`);
    } finally {
      S.bestXpPerHour = s.bestXpPerHour; S.startTime = s.startTime;
      xpRateBuffer = savedBuffer;
    }
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
  // fetch réseau) : vérifie que la fonction cible bien le fichier qui porte RÉELLEMENT le numéro
  // de version aujourd'hui, pour attraper immédiatement un futur déplacement oublié.
  //
  // 2026-07-22 (audit perf P4) : cette cible a changé une 2e fois. checkForUpdate() ne télécharge
  // plus patch-notes-data.js en entier (591 Ko, ~184 Ko gzippé) pour en extraire 5 caractères par
  // regex, toutes les 60 s et sans cache -- il lit meta/patch-notes-version.json (~14 octets),
  // généré au build depuis PATCH_NOTES[0].v. L'invariant gardé ici est le MÊME qu'en 2026-07-14
  // ("cible le fichier qui porte la version"), seule la cible bouge -- l'ancien fichier est
  // désormais lui aussi une réponse FAUSSE, au même titre que game-supabase.js.
  //
  // Ce test ne peut pas vérifier que la VALEUR des deux fichiers concorde (le harnais est
  // synchrone, pas de fetch possible) : cette dérive-là est gardée côté CI par
  // scripts/check_build_freshness.py, qui suit meta/patch-notes-version.json.
  function testCheckForUpdateFetchesFileThatActuallyCarriesTheVersion() {
    const src = checkForUpdate.toString();
    assert('checkForUpdate() fetch bien meta/patch-notes-version.json (le fichier qui porte réellement la version)',
      src.includes("'./meta/patch-notes-version.json"), `src=${src.slice(0,200)}`);
    assert('checkForUpdate() ne fetch plus meta/patch-notes-data.js (591 Ko sans cache toutes les 60 s pour 5 caractères)',
      !src.includes("'./meta/patch-notes-data.js"));
    assert('checkForUpdate() ne fetch plus game-supabase.js (ne contient plus PATCH_NOTES depuis le découpage)',
      !src.includes("'./game-supabase.js"));
    // le no-store est le POINT de ce check (détecter un déploiement à la seconde près) -- si
    // quelqu'un l'enlève un jour "pour économiser", le toast ne sortira plus jamais qu'au bout
    // de max-age. C'était la taille le problème, jamais le fait de ne pas cacher.
    assert('checkForUpdate() garde cache:no-store (sinon la détection de déploiement ne sert plus à rien)',
      src.includes("no-store"));
  }
  // "afficher un compteur 15 secondes et recharger la page tout en continuant ce que fais le
  // joueur" (2026-07-13) -- vérifie que checkForUpdate() démarre bien le compte à rebours à la
  // détection, et que le rendu initial affiche 15s. N'attend JAMAIS les 15 vraies secondes (ça
  // rechargerait réellement la page en plein milieu de la suite de tests) : le timer démarré est
  // toujours nettoyé explicitement à la fin, comme un vrai clic sur "Recharger maintenant" le ferait.
  function testUpdateCountdownStartsAt15sAndIsCleanedUp() {
    assert('checkForUpdate() démarre bien le compte à rebours à la détection d\'une MAJ',
      checkForUpdate.toString().includes('startUpdateCountdown()'));
    assert('UPDATE_AUTO_RELOAD_SEC vaut bien 15', UPDATE_AUTO_RELOAD_SEC === 15);
    startUpdateCountdown();
    const el = $a('updCountdown');
    if (el) assert('le rendu initial du compte à rebours affiche 15', el.textContent.includes('15'), `got=${el.textContent}`);
    clearInterval(updateCountdownTimer); // jamais laisser tourner un vrai setInterval après le test (recharge la page à 0)
  }
  // issue GitHub #4 (audit de sécurité, 2026-07-14), finding L1 : les messages d'erreur Supabase
  // étaient injectés via innerHTML sans échappement (game-supabase.js:showPlayerGear,
  // admin-panel.js:refreshRoleList) -- pas d'exploitation trouvée avec les RPC actuelles, mais
  // fragile si une future RPC échoue avec de l'input utilisateur dans le message. Garde-fou
  // statique : vérifie que ces 2 points passent bien error.message par escapeHtml().
  // 2026-07-20 : refreshRoleList a disparu avec la fusion de la page Joueurs (la fiche React range
  // ses erreurs dans un état rendu comme ENFANT React, donc échappé par React lui-même). Le 2e
  // volet suit désormais le SEUL chemin error.message -> HTML brut qui reste dans le panneau
  // admin : AdmReconnectFold, qui compose une chaîne HTML posée en dangerouslySetInnerHTML.
  function testErrorMessagesAreEscapedBeforeInnerHtml() {
    if (typeof showPlayerGear === 'function') {
      const src = showPlayerGear.toString();
      assert('showPlayerGear() échappe error.message avant innerHTML (escapeHtml)',
        /escapeHtml\(error\.message\)/.test(src), `src contient escapeHtml? ${src.includes('escapeHtml')}`);
    }
    if (typeof AdmReconnectFold === 'function') {
      const src = AdmReconnectFold.toString();
      assert('AdmReconnectFold() échappe error.message avant dangerouslySetInnerHTML (escapeHtml)',
        /escapeHtml\(error \? error\.message/.test(src), `src contient escapeHtml? ${src.includes('escapeHtml')}`);
    }
  }
  // "ça ne revient pas au classement du tout" (2026-07-13) : showPlayerGear() n'est atteignable
  // QUE depuis le classement (wirePlayerNameLinks(), voir leaderboard-panel.js) -- avant, seul le
  // ✕ générique (ferme tout #infoOverlay) était disponible pour en sortir, perdant la
  // catégorie/recherche/page en cours. Garde-fou statique : vérifie que showPlayerGear() pose bien
  // un bouton qui rouvre le classement (openLeaderboard2()), pas juste une fermeture complète.
  function testShowPlayerGearHasBackToLeaderboardButton() {
    if (typeof showPlayerGear !== 'function') return;
    const src = showPlayerGear.toString();
    assert('showPlayerGear() pose un bouton #btnBackToLeaderboard', src.includes('btnBackToLeaderboard'), `src=${src.slice(0,300)}`);
    assert('showPlayerGear() câble ce bouton vers openLeaderboard2()', src.includes('openLeaderboard2()'));
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
  // unification bordures/scrollbars héritées (2026-07-12) : #232128 (bordure de séparation entre
  // lignes de liste) et #3a3742 (bordure de contrôle générique + thumb de scrollbar) dataient
  // d'avant la refonte visuelle "Zone" et coexistaient, sur une trentaine de règles, avec les
  // variables --dbBorder/--dbBorder2 posées par cette refonte pour EXACTEMENT les mêmes rôles.
  // Remplacés partout hors : panneau admin (palette personnalisable via .admThemeRoot, voir
  // CLAUDE.md "admThemeRoot" -- hors périmètre) et quelques déclarations déjà MORTES en cascade
  // (#authBox input/#authBox button.ghost/.authLangBtn/.actTab, réécrites plus tard dans ce même
  // fichier par la refonte "Zone" Phase 1/Phase 9 -- laissées telles quelles pour ne pas casser
  // leur sélectivité, voir les commentaires dédiés juste au-dessus de chacune dans styles.css).
  // Garde-fou statique inspectant le CSSOM déjà chargé (même famille que
  // testSupabaseScriptIsPinnedWithIntegrity ci-dessus) pour empêcher qu'une future règle live ne
  // réintroduise ces deux valeurs en dur au lieu des variables.
  function testNoLegacyHardcodedBorderHexOutsideAdminOrDeadCascade() {
    if (typeof document === 'undefined' || !document.styleSheets) return; // hors-contexte navigateur
    const sheet = Array.from(document.styleSheets).find(s => s.href && s.href.includes('styles.css'));
    if (!sheet) return; // feuille pas trouvée dans ce contexte -- rien à vérifier
    let rootRules;
    try { rootRules = sheet.cssRules; } catch (e) { return; } // accès CSSOM bloqué (CORS) -- rien à vérifier
    const LEGACY = /#232128|#3a3742/i;
    const isExempt = sel => /admin/i.test(sel || '') || /\.adm[A-Z]/.test(sel || '')
      // déclarations mortes en cascade, voir commentaire ci-dessus -- réécrites plus loin dans le
      // même fichier par la refonte "Zone" (Phase 1 pour .actTab, Phase 9 pour #authBox/.authLangBtn)
      || /^#authBox input$/.test(sel || '') || /^#authBox button\.ghost$/.test(sel || '')
      || /^\.authLangBtn$/.test(sel || '') || /^\.actTab$/.test(sel || '');
    const offenders = [];
    const walk = list => {
      for (const rule of list) {
        if (rule.cssRules) { walk(rule.cssRules); continue; } // @media/@keyframes/etc.
        if (typeof rule.selectorText === 'undefined') continue; // pas une CSSStyleRule (ex: @font-face)
        if (isExempt(rule.selectorText)) continue;
        if (LEGACY.test(rule.cssText || '')) offenders.push(rule.selectorText || rule.cssText.slice(0, 60));
      }
    };
    walk(rootRules);
    assert('Aucune règle CSS live non-admin ne référence plus #232128/#3a3742 en dur (remplacés par var(--dbBorder)/var(--dbBorder2))',
      offenders.length === 0, `offenders=${JSON.stringify(offenders)}`);
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
  // Mouvement réduit (2026-07-22, audit repo P6). `prefers-reduced-motion: reduce` est un réglage
  // SYSTÈME : impossible de le forcer depuis la page. On teste donc ce qu'on peut tester sans lui
  // — le contrat de la fonction et l'absence de cache — et la vraie vérification sous émulation
  // (Playwright `reducedMotion:'reduce'`) est faite à part.
  function testPrefersReducedMotionHelper() {
    assert('prefersReducedMotion() existe', typeof prefersReducedMotion === 'function');
    if (typeof prefersReducedMotion !== 'function') return;
    assert('prefersReducedMotion() renvoie un booléen (jamais undefined/null)',
      typeof prefersReducedMotion() === 'boolean', `recu=${typeof prefersReducedMotion()}`);
    // Anti-cache : le réglage système se change à chaud (Windows le bascule sans rechargement).
    // Si quelqu'un "optimise" un jour en mettant le résultat dans une const au chargement, le jeu
    // ignorerait le changement jusqu'au prochain F5. On vérifie que matchMedia est bien réinterrogé
    // à CHAQUE appel, en le remplaçant temporairement.
    const real = window.matchMedia;
    try {
      let calls = 0;
      window.matchMedia = () => { calls++; return { matches: calls > 1 }; };
      const first = prefersReducedMotion(), second = prefersReducedMotion();
      assert('prefersReducedMotion() relit matchMedia à chaque appel (pas de cache au chargement)',
        calls === 2 && first === false && second === true, `calls=${calls}, first=${first}, second=${second}`);
    } finally { window.matchMedia = real; }
  }
  // Le court-circuit de la révélation de boss ne doit JAMAIS toucher au résultat : l'issue est
  // tirée dans endBossFight, la roue ne fait qu'animer l'angle. Garde-fou statique : si quelqu'un
  // déplace un jour le tirage DANS le chemin animé, le mode mouvement réduit changerait le loot
  // -- une inégalité de traitement silencieuse entre joueurs.
  function testReducedMotionBossRevealOnlySkipsAnimationNotOutcome() {
    if (typeof wireBossRewardReveal !== 'function') return;
    const src = wireBossRewardReveal.toString();
    assert('wireBossRewardReveal() consulte bien prefersReducedMotion()',
      src.includes('prefersReducedMotion'));
    assert('le mouvement réduit passe par le chemin `instant` déjà existant (celui du bouton Passer), pas par une 2e implémentation',
      /prefersReducedMotion\(\)\s*\)\s*\{[\s\S]{0,160}instant:\s*true/.test(src), `src=${src.slice(0, 60)}`);
    // rollDiceValue(instant) et la roue lisent it.rollValue / it.won -- déjà tirés en amont.
    // Si `Math.random` apparaissait dans le chemin de révélation autrement que pour le DÉFILEMENT
    // décoratif des dés, ce serait le signe que l'issue se décide ici.
    assert('revealOne ne tire aucun résultat (il ne fait que rendre it.rollValue / it.won déjà décidés)',
      !/function revealOne[\s\S]{0,400}Math\.random/.test(src));
  }
  // Découpage de game-supabase.js le 2026-07-22 (audit repo P5) : 3 124 lignes -> 1 744, les
  // 1 380 autres transplantées dans 6 fichiers. Aucune ligne n'a été réécrite (le bundle produit
  // est resté identique à l'octet près) -- le SEUL risque de ce découpage est donc l'ordre de
  // chargement, pas le code lui-même. Ce projet n'a pas de modules ES : tous les scripts partagent
  // un unique scope global, et un `const`/`let` de haut niveau lu au chargement explose si l'ordre
  // bouge (CLAUDE.md §6, et c'est exactement le bug qu'a coûté sorcier-render.js ci-dessus).
  //
  // Le piège concret ici : ces 6 fichiers vivent dans core/, backend/ et progression/, mais sont
  // TOUS déclarés après backend/game-supabase.js. Ça a l'air désordonné, donc quelqu'un voudra un
  // jour les "ranger par dossier" -- et `const CURRENT_VERSION = PATCH_NOTES[0].v` (client-health.js,
  // évalué AU CHARGEMENT) exploserait. Ce test rend cet ordre exécutable au lieu d'être une
  // convention écrite dans un README que personne ne relit.
  function testGameSupabaseSplitKeepsOriginalScriptOrder() {
    if (typeof document === 'undefined') return; // hors-contexte navigateur
    const srcIndexOf = needle => Array.from(document.scripts).findIndex(s => s.src.includes(needle));
    // l'ordre EXACT qu'occupaient ces blocs dans game-supabase.js avant le découpage
    // Ordre RÉEL des <script> dans index.dev.html (chaîne : chacun après le précédent).
    // 2e vague de découpe (2026-07-22) : presence + account chargent juste après game-supabase
    // (refs runtime seulement, pas de dépendance de chargement avec les fichiers P5). auth.js charge
    // en DERNIER car il porte le point d'entrée de l'appli (IIFE getSession → onAuthed) et lit
    // AUTH_MODES au chargement — s'il remontait avant un fichier qui appelle une fonction auth au
    // chargement, ça casserait (bug btnClearCacheAuth de P5).
    const ORDER = [
      'meta/patch-notes-data.js',      // définit PATCH_NOTES
      'backend/game-supabase.js',
      'backend/presence.js',
      'backend/account-panel.js',
      'core/i18n-legacy.js',
      'core/ui-layout.js',
      'backend/client-health.js',      // lit PATCH_NOTES[0].v AU CHARGEMENT
      'backend/wiki-codex.js',
      'progression/tutorials.js',
      'backend/patch-notes-panel.js',
      'backend/auth.js',               // DERNIER (point d'entrée + lit AUTH_MODES au chargement)
    ];
    const idx = ORDER.map(srcIndexOf);
    ORDER.forEach((f, i) => assert(`${f} est bien chargé (balise trouvée dans le DOM)`, idx[i] !== -1));
    if (idx.some(i => i === -1)) return;
    for (let i = 1; i < ORDER.length; i++) {
      assert(`${ORDER[i]} charge APRÈS ${ORDER[i-1]} (ordre d'origine dans game-supabase.js)`,
        idx[i-1] < idx[i], `${ORDER[i-1]}=${idx[i-1]}, ${ORDER[i]}=${idx[i]}`);
    }
    // l'invariant le plus dur du lot, assert à part pour qu'il soit nommé explicitement dans la
    // sortie de test si quelqu'un le casse
    assert('client-health.js charge APRÈS meta/patch-notes-data.js (il y lit PATCH_NOTES[0].v au chargement)',
      srcIndexOf('meta/patch-notes-data.js') < srcIndexOf('backend/client-health.js'));
    // auth.js porte le point d'entrée (IIFE getSession → onAuthed) : il doit tourner quand TOUT est
    // défini. Concrètement, c'est le dernier <script src="src/..."> (tests.js est à part).
    const srcTags = Array.from(document.scripts).filter(sc => /\/src\//.test(sc.src) && !/tests\.js/.test(sc.src));
    const lastSrc = srcTags[srcTags.length - 1];
    assert("backend/auth.js est le tout dernier script applicatif (point d'entrée de l'appli)",
      !!lastSrc && lastSrc.src.includes('backend/auth.js'), `dernier=${lastSrc && lastSrc.src}`);
  }
  // Bug REEL commis pendant le découpage P5, attrapé par les tests avant le merge — et le piège est
  // assez vicieux pour mériter son propre garde-fou.
  //
  // `$a('btnClearCacheAuth').onclick = clearGameCache;` vivait dans game-supabase.js, juste à côté
  // de ses frères (`= doSignInDiscord`, etc). Après le découpage, clearGameCache() est parti dans
  // client-health.js, chargé APRÈS. Or cette ligne LIT la variable au chargement -> ReferenceError,
  // qui tuait tout le reste du fichier : #btnLogoutTopbar, #btnCopyUuid et les écouteurs de
  // l'overlay d'auth n'étaient plus câblés du tout.
  //
  // CE QUI REND LE PIÈGE VICIEUX : en PROD tout est concaténé dans un seul scope, où les `function`
  // sont hoistées globalement — le bundle marchait parfaitement. Le hoisting est PAR SCRIPT : seul
  // index.dev.html cassait. Un "le build passe" ou même "le bundle est identique à l'octet près"
  // ne prouve donc RIEN sur ce mode de défaillance. Seul le vrai chargement en dev le voit.
  //
  // La correction est `= () => clearGameCache()` : la flèche repousse la résolution au clic. Ce
  // test vérifie que les boutons cross-fichier gardent cette forme différée.
  function testCrossFileButtonHandlersAreDeferred() {
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('btnClearCacheAuth');
    assert('#btnClearCacheAuth existe', !!btn);
    if (!btn) return;
    assert('#btnClearCacheAuth a bien un handler (il n\'a pas été tué par un ReferenceError au chargement)',
      typeof btn.onclick === 'function');
    // le symptôme d'origine : la ReferenceError coupait le fichier, donc TOUT ce qui suivait la
    // ligne fautive perdait son câblage. On vérifie les victimes collatérales, pas juste la cause.
    ['btnLogoutTopbar', 'btnCopyUuid'].forEach(id => {
      const el = document.getElementById(id);
      assert(`#${id} a encore son handler (câblé APRÈS btnClearCacheAuth dans game-supabase.js)`,
        !el || typeof el.onclick === 'function');
    });
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
  // raccourcis header (2026-07-13, mockup validé, voir CLAUDE.md) : garde-fou statique -- chaque
  // nouveau bouton du header existe avec un title non vide, et #btnAdminTopbar est caché par
  // défaut (montré seulement pour un compte admin, voir updateUserBar() dans game-supabase.js).
  function testHeaderShortcutButtonsExistWithTitleAndAdminHidden() {
    const ids = ['btnLeaderboardTopbar', 'btnMarketTopbar', 'btnPatchTopbar', 'btnDiscordTopbar',
      'btnDonationTopbar', 'btnAccountTopbar', 'btnAdminTopbar', 'btnLogoutTopbar'];
    for (const id of ids) {
      const el = $(id);
      assert(`#${id} existe dans le header`, !!el, id);
      if (el) assert(`#${id} a un title non vide`, !!(el.getAttribute('title') || '').trim(), el.getAttribute('title'));
    }
    const adminBtn = $('btnAdminTopbar');
    if (adminBtn) assert('#btnAdminTopbar est caché par défaut (pas isAdmin())', adminBtn.style.display === 'none', adminBtn.style.display);
  }
  // ex-test "délégation .click() vers la sidebar" (2026-07-13) RÉÉCRIT le même jour : les
  // boutons sidebar doublons (#btnLeaderboard/#btnMarket/#btnPatch/#btnDonation/#btnAdmin/
  // #btnLogout, #adminBox, #patchBadge) ont été RETIRÉS (demande explicite : "retire les
  // doublons") -- chaque bouton Topbar est désormais câblé DIRECTEMENT sur sa fonction réelle
  // (plus de proxy .click() vers un sidebar qui n'existe plus). Ce test vérifie (1) que chaque
  // raccourci header a bien un .onclick assigné (pas orphelin), et (2) garde-fou anti-retour :
  // aucun des anciens ids sidebar ne doit réapparaître dans le DOM.
  function testHeaderShortcutButtonsDelegateToSidebarClick() {
    const topbarIds = ['btnLeaderboardTopbar', 'btnMarketTopbar', 'btnPatchTopbar',
      'btnDonationTopbar', 'btnAdminTopbar', 'btnLogoutTopbar'];
    for (const id of topbarIds) {
      const btn = $(id);
      if (!btn) continue;
      assert(`#${id} a un .onclick assigné (pas de logique orpheline)`, typeof btn.onclick === 'function', id);
    }
    const removedSidebarIds = ['btnLeaderboard', 'btnMarket', 'btnDiscord', 'btnPatch',
      'btnDonation', 'btnAccount', 'btnAdmin', 'btnLogout', 'adminBox', 'patchBadge'];
    for (const id of removedSidebarIds) {
      assert(`#${id} (ancien doublon sidebar) n'existe plus dans le DOM`, !document.getElementById(id), id);
    }
  }
  // ex-test "publication de note de version sur Discord" (2026-07-20) RETIRÉ le 2026-07-13 en
  // même temps que formatPatchNoteForDiscord/publishPatchNoteToDiscord (src/admin/admin-panel.js)
  // -- plus de bouton admin manuel, l'annonce Discord passe uniquement par
  // scripts/announce-patch-note.js (CI, avec retry sur rate-limit désormais).
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
  // bug trouvé le 2026-07-23 : Sanctuaire d'Elric (zone 9, casque) a eu son reqDP relevé de 91 à
  // 101 en V267, APRÈS le dernier passage de rattrapage câblé (V245) -- un vieux Casque Grunil
  // resterait figé sur l'ancien reqDP=91 pour toujours sans migrateGearRescaleV403.
  function testGearRescaleV403RetroactiveOnZoneReqChange() {
    const s = { b: INV[INV_SIZE-1], zoneIdx };
    zoneIdx = 9; // Sanctuaire d'Elric
    const zone = ZONES[9];
    let freshHelmet = null;
    for (let i = 0; i < 2000 && !freshHelmet; i++) freshHelmet = rollGearDrop(zone, true);
    // simule un casque dropé avant le relèvement du reqDP (ancien reqDP=91 -> ancien dp plus faible)
    INV[INV_SIZE-1] = { name:'Casque Grunil', kind:'gear', slot:'helmet', ap:0, dp:1, hp:1, dodge:0.1, enhLv:5, color:GEAR_TIERS[3].color, val:1, key:'t_old_helmet' };
    migrateGearRescaleV403();
    assert('Rescale V403 : dp recalculé au reqDP ACTUEL de la zone (post-V267)',
      INV[INV_SIZE-1].dp === freshHelmet.dp, `got=${INV[INV_SIZE-1].dp}, attendu=${freshHelmet.dp}`);
    assert('Rescale V403 : enhLv déjà investi reste intact', INV[INV_SIZE-1].enhLv === 5);
    INV[INV_SIZE-1] = s.b; zoneIdx = s.zoneIdx;
  }
  // "tout les items doivent donner le chiffre... rétroactivement... je veux que le classement soit
  // mis à jour" (2026-07-23) : S.bestDp est un record À VIE qui ne redescend JAMAIS (hud() :
  // `if (dpNow > S.bestDp) S.bestDp = dpNow`) -- une correction à la BAISSE (nerf de zone) ne se
  // serait donc jamais reflétée sur le classement toute seule, même une fois le stuff corrigé.
  // migrateGearLeaderboardRecordFixV405 doit explicitement recalculer les records depuis le stuff
  // équipé corrigé, y compris pour les faire redescendre (exception volontaire à la règle habituelle).
  function testGearLeaderboardRecordFixV405RecomputesEvenDownward() {
    const s = { helmet: EQUIP.helmet, bestDp: S.bestDp, bestAp: S.bestAp, bestGearscore: S.bestGearscore, zoneIdx };
    zoneIdx = 9; // Sanctuaire d'Elric
    // vieux casque à stat gonflée (ancien tirage/reqDP plus haut) -- simule le bug avant correction
    EQUIP.helmet = { name:'Casque Grunil', kind:'gear', slot:'helmet', ap:0, dp:9999, hp:1, dodge:0, enhLv:0, optimizable:true, fsByLevel:{}, color:GEAR_TIERS[3].color, val:1, key:'t_inflated_helmet' };
    S.bestDp = 999999; // record de classement historique gonflé par le bug -- hud() seul ne le ferait jamais redescendre
    migrateGearRescaleV403(); // corrige d'abord la pièce elle-même (dp:9999 -> vraie valeur)
    migrateGearLeaderboardRecordFixV405(); // puis recalcule le record depuis le stuff corrigé
    const expectedDp = totalDP(); // recalculé APRÈS la correction du casque ci-dessus
    assert('Rescale V405 : le record de classement (bestDp) est recalculé, y compris à la baisse',
      S.bestDp === expectedDp && expectedDp < 999999, `got=${S.bestDp}, attendu=${expectedDp}`);
    EQUIP.helmet = s.helmet; S.bestDp = s.bestDp; S.bestAp = s.bestAp; S.bestGearscore = s.bestGearscore; zoneIdx = s.zoneIdx;
  }
  // "lier tout les matériaux portant le meme nom" (2026-07-13) : invAdd() fusionne déjà par nom
  // depuis le 2026-07-08, mais les piles déjà séparées AVANT ce correctif ne se fusionnent jamais
  // toutes seules -- migrateMergeStackableDuplicatesV407 doit les rattraper au chargement.
  function testMergeStackableDuplicatesV407MergesSameNamePiles() {
    const s = { slots: [INV[INV_SIZE-1], INV[INV_SIZE-2], INV[INV_SIZE-3]] };
    INV[INV_SIZE-1] = { name:'Pierre concentrée', kind:'material', stackable:true, qty:12, key:'t_dup_a', val:1 };
    INV[INV_SIZE-2] = { name:'Pierre concentrée', kind:'material', stackable:true, qty:7, key:'t_dup_b', val:1 };
    INV[INV_SIZE-3] = { name:'Pierre concentrée', kind:'material', stackable:true, qty:3, key:'t_dup_c', val:1 };
    migrateMergeStackableDuplicatesV407();
    // la boucle parcourt INV par index CROISSANT -- la 1ère occurrence rencontrée (index le plus
    // bas, ici INV_SIZE-3) est celle qui absorbe les suivantes, pas l'ordre d'insertion du test
    assert('Rescale V407 : la 1ère occurrence rencontrée (index le plus bas) absorbe la quantité des autres',
      INV[INV_SIZE-3].qty === 22, `got=${INV[INV_SIZE-3].qty}`);
    assert('Rescale V407 : les piles suivantes sont vidées (slot libéré)',
      INV[INV_SIZE-2] === null && INV[INV_SIZE-1] === null);
    INV[INV_SIZE-1] = s.slots[0]; INV[INV_SIZE-2] = s.slots[1]; INV[INV_SIZE-3] = s.slots[2];
  }
  // "ajouter un slider a choix de nombre lorsqu'on pose en banque" (2026-07-13) : veliaChestStore
  // acceptait déjà un `n` en paramètre (jamais utilisé par l'UI, toujours appelé avec 1) -- vérifie
  // qu'un dépôt partiel (n < qty totale) laisse bien le reste dans le sac, pas tout ou rien.
  function testVeliaChestStorePartialQuantityFromSlider() {
    const s = { inv: INV[INV_SIZE-1], chest0: VELIA_CHEST[0] };
    INV[INV_SIZE-1] = { name:'t_slider_mat', kind:'material', stackable:true, qty:10, key:'t_slider_mat', val:1 };
    VELIA_CHEST[0] = null; // case libre garantie pour le test (case 0 toujours < VELIA_CHEST_OPEN)
    const ok = veliaChestStore(INV_SIZE-1, 6);
    assert('veliaChestStore(n) : dépôt partiel réussi', ok === true);
    assert('veliaChestStore(n) : le sac garde le reliquat (10-6=4)', INV[INV_SIZE-1] && INV[INV_SIZE-1].qty === 4, `got=${INV[INV_SIZE-1] && INV[INV_SIZE-1].qty}`);
    assert('veliaChestStore(n) : le coffre reçoit exactement la quantité choisie (6)', VELIA_CHEST[0] && VELIA_CHEST[0].qty === 6, `got=${VELIA_CHEST[0] && VELIA_CHEST[0].qty}`);
    INV[INV_SIZE-1] = s.inv; VELIA_CHEST[0] = s.chest0;
  }
  // "les premiers qui sont full stuff n'ont pas le même GS" (2026-07-13) : bestGearscore était
  // tracké comme un 3e record indépendant de bestAp/bestDp (voir hud()) -- peut désormais dériver
  // vers l'incohérence si les 2 records montent à des instants différents. Vérifie que hud() dérive
  // bien bestGearscore = (bestAp+bestDp)/2 à chaque tick, jamais un pic indépendant.
  function testHudDerivesGearscoreFromBestApDp() {
    const s = { bestAp: S.bestAp, bestDp: S.bestDp, bestGearscore: S.bestGearscore };
    S.bestAp = 100; S.bestDp = 50; S.bestGearscore = 999999; // record historique volontairement incohérent
    hud();
    assert('hud() dérive bestGearscore = (bestAp+bestDp)/2, jamais un pic indépendant',
      S.bestGearscore === (S.bestAp + S.bestDp) / 2, `got=${S.bestGearscore}, bestAp=${S.bestAp}, bestDp=${S.bestDp}`);
    S.bestAp = s.bestAp; S.bestDp = s.bestDp; S.bestGearscore = s.bestGearscore;
  }
  // migration rétroactive : un vieux compte peut avoir un bestGearscore déjà incohérent AVANT le
  // correctif de hud() ci-dessus (figé pour toujours sinon, hud() ne recalcule qu'au PROCHAIN pic
  // battu) -- migrateGearscoreDerivedFixV414 doit le rattraper une bonne fois pour toutes.
  function testGearscoreDerivedFixV414RetroactivelyCorrectsStaleRecord() {
    const s = { bestAp: S.bestAp, bestDp: S.bestDp, bestGearscore: S.bestGearscore };
    S.bestAp = 300; S.bestDp = 200; S.bestGearscore = 999999; // vieux record incohérent, jamais rattrapé par hud() seul
    migrateGearscoreDerivedFixV414();
    assert('Rescale V414 : bestGearscore recalculé depuis bestAp/bestDp déjà enregistrés',
      S.bestGearscore === 250, `got=${S.bestGearscore}`);
    S.bestAp = s.bestAp; S.bestDp = s.bestDp; S.bestGearscore = s.bestGearscore;
  }
  // "il faut remettre a 0 ce classement" (2026-07-13) : records bestSilverPerHour existants
  // potentiellement gonflés par le bug windowMs corrigé le même jour (bourrasque au reconnexion,
  // voir SILVER_RATE_MIN_SPAN_MS) -- remise à zéro explicite, pas de recalcul possible (aucune
  // autre source ne permet de reconstituer le "vrai" taux historique).
  function testSilverPerHourResetV436ZeroesStaleRecord() {
    if (typeof migrateSilverPerHourResetV436 !== 'function') return;
    const before = S.bestSilverPerHour;
    S.bestSilverPerHour = 999999999; // vieux record potentiellement gonflé par le bug corrigé
    migrateSilverPerHourResetV436();
    assert('Reset V436 : bestSilverPerHour remis à 0, quelle que soit sa valeur précédente', S.bestSilverPerHour === 0, `got=${S.bestSilverPerHour}`);
    S.bestSilverPerHour = before;
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
  // même garde-fou que testComputeOfflineCatchupSilverCapsAndThresholds, version XP (2026-07-12,
  // demande explicite : "ajoute le rattrapage XP" -- annule la décision précédente de ne pas
  // simuler l'XP) -- computeOfflineCatchupXp() doit : ignorer une sauvegarde sans savedAt/taux
  // (y compris une ancienne sauvegarde où S.bestXpPerHour n'existe même pas encore), ignorer une
  // absence sous le seuil minimum, calculer un gain proportionnel au temps réel écoulé, et
  // plafonner à OFFLINE_CATCHUP_CAP_HOURS même pour une absence bien plus longue.
  function testComputeOfflineCatchupXpCapsAndThresholds() {
    if (typeof computeOfflineCatchupXp !== 'function') return;
    const rate = 3600; // valeur ronde : 3600 xp/h = 1 xp/s
    assert('Sans savedAt -> 0, pas de throw', computeOfflineCatchupXp({ S:{ bestXpPerHour: rate } }) === 0);
    assert('Sans taux connu (bestXpPerHour=0) -> 0', computeOfflineCatchupXp({ savedAt: new Date(Date.now()-3600000).toISOString(), S:{ bestXpPerHour:0 } }) === 0);
    const oneHourAgo = new Date(Date.now() - 3600*1000).toISOString();
    assert('Sauvegarde antérieure à cette feature (S.bestXpPerHour absent) -> 0, pas de throw', computeOfflineCatchupXp({ savedAt: oneHourAgo, S:{} }) === 0);
    const oneMinuteAgo = new Date(Date.now() - 60*1000).toISOString();
    assert('Absence sous OFFLINE_CATCHUP_MIN_HOURS (~3 min) -> 0', computeOfflineCatchupXp({ savedAt: oneMinuteAgo, S:{ bestXpPerHour: rate } }) === 0);
    const gain1h = computeOfflineCatchupXp({ savedAt: oneHourAgo, S:{ bestXpPerHour: rate } });
    assert('1h d\'absence à 3600 xp/h -> ~3600 xp', Math.abs(gain1h - rate) <= 2, `gain=${gain1h}`);
    const fortyEightHoursAgo = new Date(Date.now() - 48*3600*1000).toISOString();
    const gainCapped = computeOfflineCatchupXp({ savedAt: fortyEightHoursAgo, S:{ bestXpPerHour: rate } });
    assert('Plafonné à OFFLINE_CATCHUP_CAP_HOURS (24h) même après 48h d\'absence', Math.abs(gainCapped - rate*OFFLINE_CATCHUP_CAP_HOURS) <= 2, `gain=${gainCapped}`);
  }
  // computeOfflineCatchupLoot() (2026-07-13, demande explicite : "la 0 en 5min c'est pas possible" --
  // le modal affichait du silver gagné mais 0 objet) : ESPÉRANCE mathématique à partir de la table
  // de loot RÉELLE de la zone (data.zoneIdx) + bestKpm, PAS un taux/h à un seul nombre. Vérifie que
  // le matériau du palier est bien estimé avec la bonne quantité (kills × chance de drop), et que
  // le trash est exclu (déjà couvert par computeOfflineCatchupSilver, éviterait un double-comptage).
  function testComputeOfflineCatchupLootUsesZoneLootTableAndKpm() {
    if (typeof computeOfflineCatchupLoot !== 'function') return;
    const oneHourAgo = new Date(Date.now() - 3600*1000).toISOString();
    const items = computeOfflineCatchupLoot({ savedAt: oneHourAgo, zoneIdx: 0, S: { bestKpm: 10 } });
    assert('computeOfflineCatchupLoot() retourne au moins un objet estimé pour 1h à 10 kills/min',
      items.length > 0, JSON.stringify(items));
    const matName = gearTierForZone(0).material.name;
    const mat = items.find(it => it.name === matName);
    assert(`Le matériau du palier (${matName}) est bien estimé`, !!mat, JSON.stringify(items));
    if (mat) {
      // 1h à 10 kills/min = 600 kills équivalents ; ZONES[0].loot.mat.ch = .55 -> ~330
      assert('Quantité proche de kills(600)×chance de drop de la zone', Math.abs(mat.qty - 600*ZONES[0].loot.mat.ch) <= 3, `qty=${mat.qty}`);
    }
    assert('computeOfflineCatchupLoot() exclut le trash (déjà couvert par le silver de rattrapage, éviterait un double-comptage)',
      !items.some(it => it.kind === 'trash'));
  }
  function testComputeOfflineCatchupLootReturnsEmptyWithoutKpmOrSavedAt() {
    if (typeof computeOfflineCatchupLoot !== 'function') return;
    const oneHourAgo = new Date(Date.now() - 3600*1000).toISOString();
    assert('Sans bestKpm connu -> []', computeOfflineCatchupLoot({ savedAt: oneHourAgo, zoneIdx:0, S:{ bestKpm:0 } }).length === 0);
    assert('Sans savedAt -> []', computeOfflineCatchupLoot({ zoneIdx:0, S:{ bestKpm:10 } }).length === 0);
    const oneMinuteAgo = new Date(Date.now() - 60*1000).toISOString();
    assert('Absence sous OFFLINE_CATCHUP_MIN_HOURS (~3 min) -> []', computeOfflineCatchupLoot({ savedAt: oneMinuteAgo, zoneIdx:0, S:{ bestKpm:10 } }).length === 0);
  }
  // "Phase 2" du rattrapage hors-ligne (2026-07-14) : un cron SERVEUR horaire
  // (credit_offline_progress_hourly(), supabase/migrations/20260722120000_offline_progress_hourly_cron.sql)
  // crédite désormais aussi silver/XP/loot pendant que le navigateur est fermé, sans plafond de
  // durée. Pour ne jamais recompter côté client un intervalle déjà crédité côté serveur,
  // computeOfflineElapsedHours() doit utiliser le PLUS RÉCENT de data.savedAt et
  // data.lastServerCreditAt comme point de départ -- ce test vérifie les 3 cas : sans
  // lastServerCreditAt (comportement Phase 1 inchangé), avec un lastServerCreditAt PLUS RÉCENT que
  // savedAt (le serveur a crédité après le dernier vrai enregistrement -- doit gagner), et avec un
  // lastServerCreditAt PLUS ANCIEN que savedAt (le client a rejoué/sauvegardé depuis -- savedAt doit
  // gagner, ne jamais reculer la baseline).
  function testComputeOfflineElapsedHoursUsesMoreRecentOfSavedAtAndServerCredit() {
    if (typeof computeOfflineElapsedHours !== 'function') return;
    const threeHoursAgo = new Date(Date.now() - 3*3600*1000).toISOString();
    const oneHourAgo = new Date(Date.now() - 1*3600*1000).toISOString();
    const fiveHoursAgo = new Date(Date.now() - 5*3600*1000).toISOString();
    // sans lastServerCreditAt (sauvegardes antérieures à Phase 2, ou champ absent) -> comportement
    // Phase 1 inchangé, basé uniquement sur savedAt.
    const hoursNoServerCredit = computeOfflineElapsedHours({ savedAt: threeHoursAgo });
    assert('Sans lastServerCreditAt -> basé uniquement sur savedAt (~3h)',
      Math.abs(hoursNoServerCredit - 3) <= 0.01, `hours=${hoursNoServerCredit}`);
    // lastServerCreditAt PLUS RÉCENT que savedAt (cron passé après le dernier vrai enregistrement)
    // -> la baseline doit être lastServerCreditAt (~1h), pas savedAt (~3h) : sinon Phase 1
    // recompterait les 2h déjà créditées par le cron serveur.
    const hoursServerCreditMoreRecent = computeOfflineElapsedHours({ savedAt: threeHoursAgo, lastServerCreditAt: oneHourAgo });
    assert('lastServerCreditAt plus récent que savedAt -> baseline = lastServerCreditAt (~1h, pas ~3h)',
      Math.abs(hoursServerCreditMoreRecent - 1) <= 0.01, `hours=${hoursServerCreditMoreRecent}`);
    // lastServerCreditAt PLUS ANCIEN que savedAt (le client a rejoué/sauvegardé depuis le dernier
    // crédit serveur) -> la baseline reste savedAt (~1h), ne doit JAMAIS reculer vers un horodatage
    // plus ancien que le dernier enregistrement client réel.
    const hoursServerCreditOlder = computeOfflineElapsedHours({ savedAt: oneHourAgo, lastServerCreditAt: fiveHoursAgo });
    assert('lastServerCreditAt plus ancien que savedAt -> baseline reste savedAt (~1h, jamais recule)',
      Math.abs(hoursServerCreditOlder - 1) <= 0.01, `hours=${hoursServerCreditOlder}`);
    // lastServerCreditAt invalide/vide -> ignoré proprement, pas de throw, repli sur savedAt.
    const hoursServerCreditEmpty = computeOfflineElapsedHours({ savedAt: threeHoursAgo, lastServerCreditAt: null });
    assert('lastServerCreditAt null -> ignoré, repli sur savedAt (~3h), pas de throw',
      Math.abs(hoursServerCreditEmpty - 3) <= 0.01, `hours=${hoursServerCreditEmpty}`);
  }
  // Garde-fou anti-désynchronisation pour la table SQL dupliquée `offline_credit_zone_loot`
  // (supabase/migrations/20260722120000_offline_progress_hourly_cron.sql) : cette table transcrit
  // MANUELLEMENT les chances de drop / valeurs / noms de ZONES[].loot.mat/.craft (world/zones-data.js)
  // + GEAR_TIERS[].material (world/gear-tiers-data.js, via gearTierForZone()), car credit_offline_
  // progress_hourly() (le cron serveur qui simule computeOfflineCatchupLoot() pour 1h) ne peut pas
  // lire ce fichier JS directement (pas de bundler/module ici, voir CLAUDE.md §7 -- et aucune Edge
  // Function n'existe encore dans ce repo pour servir de pont). Si zones-data.js ou
  // gear-tiers-data.js sont un jour rééquilibrés SANS mettre à jour cette table SQL, le cron serveur
  // créditerait un montant différent de ce que Phase 1 (côté client) calculerait pour la même heure
  // -- ce test compare la snapshot figée ci-dessous (= exactement le contenu de la migration SQL) à
  // ZONES/GEAR_TIERS RÉELS à l'exécution, et échoue dès qu'ils divergent : un échec ici est le signal
  // explicite qu'une NOUVELLE migration SQL (jamais modifier celle déjà appliquée, CLAUDE.md §12) est
  // due pour resynchroniser offline_credit_zone_loot.
  function testOfflineCreditZoneLootTableMatchesClientZonesData() {
    if (typeof ZONES === 'undefined' || typeof gearTierForZone !== 'function') return;
    // snapshot exacte des valeurs INSERT de 20260722120000_offline_progress_hourly_cron.sql
    const SQL_SNAPSHOT = [
      { zone_idx:0,  mat_name:'Pierre de Novice',  mat_color:'#b8b8b8', mat_val:1,  mat_ch:0.55,  craft_name:"Poussière d'esprit ancien", craft_ch:0.03 },
      { zone_idx:1,  mat_name:'Pierre de Novice',  mat_color:'#b8b8b8', mat_val:1,  mat_ch:0.48,  craft_name:"Poussière d'esprit ancien", craft_ch:0.026 },
      { zone_idx:2,  mat_name:'Pierre de Novice',  mat_color:'#b8b8b8', mat_val:1,  mat_ch:0.4,   craft_name:"Poussière d'esprit ancien", craft_ch:0.022 },
      { zone_idx:3,  mat_name:'Pierre du Temps',   mat_color:'#cfd8dc', mat_val:1,  mat_ch:0.32,  craft_name:"Poussière d'esprit ancien", craft_ch:0.018 },
      { zone_idx:4,  mat_name:'Pierre du Temps',   mat_color:'#cfd8dc', mat_val:1,  mat_ch:0.26,  craft_name:"Poussière d'esprit ancien", craft_ch:0.015 },
      { zone_idx:5,  mat_name:'Pierre du Temps',   mat_color:'#cfd8dc', mat_val:4,  mat_ch:0.2,   craft_name:"Poussière d'esprit ancien", craft_ch:0.012 },
      { zone_idx:6,  mat_name:'Pierre Noire',      mat_color:'#7aa35e', mat_val:11, mat_ch:0.15,  craft_name:'Fragment de mémoire',       craft_ch:0.009 },
      { zone_idx:7,  mat_name:'Pierre Noire',      mat_color:'#7aa35e', mat_val:11, mat_ch:0.11,  craft_name:'Fragment de mémoire',       craft_ch:0.007 },
      { zone_idx:8,  mat_name:'Pierre Noire',      mat_color:'#7aa35e', mat_val:9,  mat_ch:0.08,  craft_name:'Fragment de mémoire',       craft_ch:0.005 },
      { zone_idx:9,  mat_name:'Pierre concentrée', mat_color:'#6ea3c9', mat_val:7,  mat_ch:0.12,  craft_name:'Marbre du Dieu déchu',      craft_ch:0.0035 },
      { zone_idx:10, mat_name:'Pierre concentrée', mat_color:'#6ea3c9', mat_val:6,  mat_ch:0.09,  craft_name:'Marbre du Dieu déchu',      craft_ch:0.0025 },
      { zone_idx:11, mat_name:'Pierre concentrée', mat_color:'#6ea3c9', mat_val:5,  mat_ch:0.07,  craft_name:'Marbre du Dieu déchu',      craft_ch:0.0018 },
      { zone_idx:12, mat_name:'Pierre de Novice',  mat_color:'#b8b8b8', mat_val:1,  mat_ch:0.34,  craft_name:"Poussière d'esprit ancien", craft_ch:0.019 },
      { zone_idx:13, mat_name:'Pierre du Temps',   mat_color:'#cfd8dc', mat_val:5,  mat_ch:0.14,  craft_name:"Poussière d'esprit ancien", craft_ch:0.009 },
      { zone_idx:14, mat_name:'Pierre Noire',      mat_color:'#7aa35e', mat_val:8,  mat_ch:0.058, craft_name:'Fragment de mémoire',       craft_ch:0.003 },
      { zone_idx:15, mat_name:'Pierre concentrée', mat_color:'#6ea3c9', mat_val:4,  mat_ch:0.055, craft_name:'Marbre du Dieu déchu',      craft_ch:0.0013 },
    ];
    assert('offline_credit_zone_loot couvre exactement les 16 zones actuelles de ZONES',
      SQL_SNAPSHOT.length === ZONES.length, `SQL=${SQL_SNAPSHOT.length}, ZONES=${ZONES.length}`);
    for (const row of SQL_SNAPSHOT) {
      const z = ZONES[row.zone_idx];
      if (!z) continue; // déjà signalé par l'assertion de longueur ci-dessus
      const tier = gearTierForZone(row.zone_idx);
      assert(`Zone ${row.zone_idx} (${z.name}) : mat_name synchronisé (tier.material.name)`,
        tier.material.name === row.mat_name, `attendu=${row.mat_name}, réel=${tier.material.name}`);
      assert(`Zone ${row.zone_idx} (${z.name}) : mat_color synchronisé (tier.material.color)`,
        tier.material.color === row.mat_color, `attendu=${row.mat_color}, réel=${tier.material.color}`);
      assert(`Zone ${row.zone_idx} (${z.name}) : mat_val synchronisé (ZONES[].loot.mat.val)`,
        z.loot.mat.val === row.mat_val, `attendu=${row.mat_val}, réel=${z.loot.mat.val}`);
      assert(`Zone ${row.zone_idx} (${z.name}) : mat_ch synchronisé (ZONES[].loot.mat.ch)`,
        Math.abs(z.loot.mat.ch - row.mat_ch) < 1e-9, `attendu=${row.mat_ch}, réel=${z.loot.mat.ch}`);
      assert(`Zone ${row.zone_idx} (${z.name}) : craft_name synchronisé (ZONES[].loot.craft.name)`,
        z.loot.craft.name === row.craft_name, `attendu=${row.craft_name}, réel=${z.loot.craft.name}`);
      assert(`Zone ${row.zone_idx} (${z.name}) : craft_ch synchronisé (ZONES[].loot.craft.ch)`,
        Math.abs(z.loot.craft.ch - row.craft_ch) < 1e-9, `attendu=${row.craft_ch}, réel=${z.loot.craft.ch}`);
    }
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
  // vérifie l'intégration bout-en-bout côté XP (2026-07-12, demande explicite : "ajoute le
  // rattrapage XP") -- computeOfflineCatchupXp()/gainXp() doivent créditer l'XP ET gérer un vrai
  // passage de niveau EN CASCADE si le rattrapage dépasse le seuil du niveau en cours (piège
  // classique : un code qui ferait juste `S.xp += gain` sans boucle de passage de niveau laisserait
  // S.xp très au-delà de S.xpNext sans faire monter S.lvl -- ce test le détecterait). Vérifie aussi
  // que S.xpEarnedAtLoad est re-basé APRÈS le rattrapage (comme tokenSilverEarned pour le silver) :
  // sinon ce gain hors-ligne compterait comme un gain de LA session en cours et fausserait le
  // prochain calcul de bestXpPerHour.
  function testApplySaveStateOfflineCatchupCreditsXpAndHandlesLevelUp() {
    if (typeof applySaveState !== 'function' || typeof showAwayLootSummaryIfAny !== 'function' || typeof computeOfflineCatchupXp !== 'function') return;
    const root = document.getElementById('reconnectModalRoot'); if (!root) return;
    const s = { zoneIdx, atVelia, lvl: S.lvl, xp: S.xp, xpNext: S.xpNext, xpEarned: S.xpEarned,
      xpEarnedAtLoad: S.xpEarnedAtLoad, bestXpPerHour: S.bestXpPerHour, hpMax: S.hpMax, silver: S.silver,
      silverEarned: S.silverEarned, bestSilverPerHour: S.bestSilverPerHour };
    const savedAwayXp = awayXpGained, savedAwaySilver = awaySilverGained, savedAwayLoot = { ...awayLootCounts };
    try {
      atVelia = false;
      // niveau 5 : xpNeededFor(5)=161 (LEVEL_XP_TABLE) -- un palier "normal", pas les tout premiers
      // niveaux quasi gratuits (0-4 coûtent 1 xp chacun), pour un test représentatif d'une vraie
      // cascade de plusieurs niveaux d'un coup.
      S.lvl = 5; S.xp = 100; S.xpNext = xpNeededFor(5);
      const save = getSaveState();
      save.S.bestXpPerHour = 3600; // 1 xp/s pile
      save.S.bestSilverPerHour = 0; // isole le test : pas de rattrapage silver ici
      save.savedAt = new Date(Date.now() - 3600*1000).toISOString(); // 1h d'absence réelle
      const xpEarnedBefore = save.S.xpEarned || 0;
      const offlineXpGain = computeOfflineCatchupXp(save); // valeur exacte réellement utilisée (évite tout flake de timing sur ~3600)
      assert('computeOfflineCatchupXp calcule bien un gain proche de 3600 (1h à 3600 xp/h)', Math.abs(offlineXpGain - 3600) <= 5, `offlineXpGain=${offlineXpGain}`);
      // simule la MÊME boucle de cascade que gainXp() (xpNeededFor/LEVEL_XP_TABLE, code réel du
      // jeu) à partir de l'état "avant" de la sauvegarde, pour obtenir le résultat attendu SANS
      // dupliquer la logique métier dans le test -- seul le déclenchement bout-en-bout est vérifié.
      let lvl = save.S.lvl, xp = save.S.xp + offlineXpGain;
      while (xp >= xpNeededFor(lvl)) { xp -= xpNeededFor(lvl); lvl++; }
      applySaveState(save);
      assert('applySaveState() fait bien progresser le niveau via le rattrapage XP (cascade multi-niveaux)',
        S.lvl === lvl, `S.lvl=${S.lvl}, attendu=${lvl}`);
      assert('applySaveState() applique bien le reliquat d\'XP correct après cascade', S.xp === xp, `S.xp=${S.xp}, attendu=${xp}`);
      assert('applySaveState() a bien fait progresser le niveau (au moins un passage de niveau attendu ici)', S.lvl > save.S.lvl, `S.lvl=${S.lvl}`);
      assert('S.xpEarned (compteur À VIE) inclut bien le rattrapage hors-ligne', S.xpEarned >= xpEarnedBefore + offlineXpGain, `xpEarned=${S.xpEarned}`);
      assert('S.xpEarnedAtLoad est re-basé APRÈS le rattrapage (n\'inflate pas la session qui commence)',
        S.xpEarnedAtLoad === S.xpEarned, `xpEarnedAtLoad=${S.xpEarnedAtLoad}, xpEarned=${S.xpEarned}`);
      assert('Le modal "Bon retour" s\'affiche après un rattrapage XP hors-ligne réel', root.innerHTML.includes('Bon retour'), root.innerHTML.slice(0,120));
    } finally {
      zoneIdx = s.zoneIdx; atVelia = s.atVelia; updateZoneTitleText();
      S.lvl = s.lvl; S.xp = s.xp; S.xpNext = s.xpNext; S.xpEarned = s.xpEarned; S.xpEarnedAtLoad = s.xpEarnedAtLoad;
      S.bestXpPerHour = s.bestXpPerHour; S.hpMax = s.hpMax; S.silver = s.silver; S.silverEarned = s.silverEarned; S.bestSilverPerHour = s.bestSilverPerHour;
      awayXpGained = savedAwayXp; awaySilverGained = savedAwaySilver; awayLootCounts = savedAwayLoot;
    }
  }
  // garde-fou (2026-07-12) : showAwayLootSummaryIfAny() sortait silencieusement (return anticipé)
  // si SEULE de l'XP avait été gagnée pendant l'absence (awaySilverGained<=0 ET awayLootCounts
  // vide) -- la garde ne testait pas awayXpGained, un rattrapage 100% XP (silver rate à 0 mais xp
  // rate>0) n'aurait donc jamais affiché le modal.
  function testShowAwayLootSummaryTriggersOnXpOnlyGain() {
    if (typeof showAwayLootSummaryIfAny !== 'function') return;
    const root = document.getElementById('reconnectModalRoot'); if (!root) return;
    const savedAwaySilver = awaySilverGained, savedAwayXp = awayXpGained, savedAwayLoot = { ...awayLootCounts };
    try {
      awaySilverGained = 0; awayXpGained = 500; awayLootCounts = {};
      showAwayLootSummaryIfAny();
      assert('Le modal "Bon retour" s\'affiche même si seule de l\'XP a été gagnée (silver=0)',
        root.innerHTML.includes('Bon retour'), root.innerHTML.slice(0,120));
      assert('showAwayLootSummaryIfAny() remet awayXpGained à 0 après affichage', awayXpGained === 0, `awayXpGained=${awayXpGained}`);
    } finally {
      awaySilverGained = savedAwaySilver; awayXpGained = savedAwayXp; awayLootCounts = savedAwayLoot;
    }
  }
  // vérifie l'intégration bout-en-bout du rattrapage LOOT (2026-07-13) : applySaveState() doit
  // réellement ajouter les objets estimés dans INV (pas juste les afficher dans le modal), et
  // peupler awayLootCounts en conséquence -- réserve/restaure 2 slots dédiés (voir CLAUDE.md
  // section tests "sac plein", pattern testCompendiumEvictsItemOnceItReachesPen) pour ne jamais
  // dépendre du remplissage réel du sac démo.
  function testApplySaveStateOfflineCatchupCreditsLootIntoInv() {
    if (typeof applySaveState !== 'function' || typeof computeOfflineCatchupLoot !== 'function') return;
    const root = document.getElementById('reconnectModalRoot'); if (!root) return;
    const s = { zoneIdx, atVelia, invSlots: [INV[INV_SIZE-3], INV[INV_SIZE-4]],
      bestKpm: S.bestKpm, bestSilverPerHour: S.bestSilverPerHour, bestXpPerHour: S.bestXpPerHour,
      silver: S.silver, silverEarned: S.silverEarned, tokenSilverEarned: S.tokenSilverEarned };
    const savedAwaySilver = awaySilverGained, savedAwayLoot = { ...awayLootCounts };
    try {
      atVelia = false; zoneIdx = 0;
      INV[INV_SIZE-3] = null; INV[INV_SIZE-4] = null; // slots dédiés libres pour ce test
      const save = getSaveState();
      save.zoneIdx = 0;
      save.S.bestKpm = 10;
      save.S.bestSilverPerHour = 0; // isole le loot : pas de rattrapage silver à côté
      save.S.bestXpPerHour = 0;
      save.savedAt = new Date(Date.now() - 3600*1000).toISOString(); // 1h d'absence réelle
      // pas de root.innerHTML='' ici (même piège CLAUDE.md §32 que les autres tests de ce fichier
      // sur #reconnectModalRoot) : openReconnectModal() gère lui-même le remplacement.
      applySaveState(save);
      const matName = gearTierForZone(0).material.name;
      // awayLootCounts est remis à {} par showAwayLootSummaryIfAny() APRÈS affichage (même pattern
      // que awaySilverGained, voir testApplySaveStateOfflineCatchupCreditsSilverAndShowsReconnectModal
      // qui vérifie S.silver plutôt que awaySilverGained pour la même raison) -- la preuve que le
      // loot n'était PAS resté à "0 objet" se vérifie donc dans le modal rendu, pas dans la
      // variable transitoire déjà réinitialisée à ce stade.
      assert('Le modal "Bon retour" affiche bien du loot réel (pas 0 objet malgré 1h d\'absence à 10 kills/min)',
        root.innerHTML.includes(matName), root.innerHTML.slice(0,200));
      assert(`Les objets estimés sont réellement ajoutés à INV (${matName} présent dans le sac, pas juste affiché)`,
        INV.some(it => it && it.name === matName), 'INV ne contient pas ' + matName);
    } finally {
      zoneIdx = s.zoneIdx; atVelia = s.atVelia; updateZoneTitleText();
      INV[INV_SIZE-3] = s.invSlots[0]; INV[INV_SIZE-4] = s.invSlots[1];
      S.bestKpm = s.bestKpm; S.bestSilverPerHour = s.bestSilverPerHour; S.bestXpPerHour = s.bestXpPerHour;
      S.silver = s.silver; S.silverEarned = s.silverEarned; S.tokenSilverEarned = s.tokenSilverEarned;
      awaySilverGained = savedAwaySilver; awayLootCounts = savedAwayLoot;
    }
  }
  // régression "sac plein" (2026-07-13) : le rattrapage loot hors-ligne appelle invAdd() pour
  // chaque objet estimé -- invAdd() retourne false SANS throw si le sac est plein (piège documenté
  // CLAUDE.md section tests), applySaveState() ne doit donc jamais planter, et un objet refusé ne
  // doit PAS apparaître dans awayLootCounts (rien de fantôme affiché que le joueur n'a pas reçu).
  function testOfflineCatchupLootSkipsGracefullyWhenBagFull() {
    if (typeof applySaveState !== 'function' || typeof computeOfflineCatchupLoot !== 'function') return;
    const root = document.getElementById('reconnectModalRoot'); if (!root) return;
    const s = { zoneIdx, atVelia, INV: INV.map(x => x ? { ...x } : null),
      bestKpm: S.bestKpm, bestSilverPerHour: S.bestSilverPerHour, bestXpPerHour: S.bestXpPerHour };
    const savedAwaySilver = awaySilverGained, savedAwayLoot = { ...awayLootCounts };
    try {
      atVelia = false; zoneIdx = 0;
      const save = getSaveState();
      save.zoneIdx = 0;
      save.S.bestKpm = 10;
      save.S.bestSilverPerHour = 0;
      save.S.bestXpPerHour = 3600; // garde le modal déclenché (silver=0/loot bloqué, mais xp>0)
      save.savedAt = new Date(Date.now() - 3600*1000).toISOString();
      // sac totalement plein, objets NON stackable distincts (jamais de slot libre pour merger)
      for (let i=0;i<INV_SIZE;i++) save.INV[i] = { name:'Test Bag Full Item '+i, key:'testfull_'+i, kind:'gear', qty:1, stackable:false, val:1, weight:0.1 };
      let threw = false;
      try { applySaveState(save); } catch(e) { threw = true; }
      assert('applySaveState() ne plante pas quand le sac est plein pendant le rattrapage loot hors-ligne', !threw);
      const matName = gearTierForZone(0).material.name;
      assert('Sac plein : le matériau de rattrapage n\'est PAS ajouté à INV (invAdd() a échoué proprement, rien perdu ni fantôme)',
        !INV.some(it => it && it.name === matName), 'INV contient ' + matName + ' alors que le sac était plein');
      // le modal reste affiché (silver=0/loot bloqué, mais xp>0, voir bestXpPerHour ci-dessus) --
      // mais ne doit pas prétendre avoir donné un objet que le joueur n'a en réalité pas reçu
      assert('Sac plein : le modal "Bon retour" ne montre pas le matériau bloqué (rien de fantôme affiché)',
        !root.innerHTML.includes(matName), root.innerHTML.slice(0,200));
    } finally {
      zoneIdx = s.zoneIdx; atVelia = s.atVelia; updateZoneTitleText();
      for (let i=0;i<INV_SIZE;i++) INV[i] = s.INV[i];
      S.bestKpm = s.bestKpm; S.bestSilverPerHour = s.bestSilverPerHour; S.bestXpPerHour = s.bestXpPerHour;
      awaySilverGained = savedAwaySilver; awayLootCounts = savedAwayLoot;
    }
  }
  // détail dépliable de l'historique hors-ligne (2026-07-15, demande explicite : "pouvoir voir
  // l'historique du mode hors ligne ... quand on clique sur l'histo") -- chaque session passée est
  // cliquable dans le modal de reconnexion pour révéler son détail (niveau avant→après, XP, objets).
  // Teste le composant RcHistoryDetail isolément (rendu synchrone via flushSync dans un noeud
  // détaché) : le clic->dépliage lui-même (état React expandedId) est couvert par un test Playwright.
  function testReconnectHistoryDetailRendersSessionBreakdown() {
    if (typeof RcHistoryDetail !== 'function' || typeof React === 'undefined' || typeof ReactDOM === 'undefined') return;
    const container = document.createElement('div');
    const root = ReactDOM.createRoot(container);
    try {
      const session = { levelBefore: 40, levelAfter: 42, xp: 12345,
        items: [{ name: 'ObjetHistoTest', color: '#8ab4f8', qty: 7 }] };
      ReactDOM.flushSync(() => root.render(React.createElement(RcHistoryDetail, { session })));
      const html = container.innerHTML;
      assert('RcHistoryDetail affiche le niveau avant→après de la session', html.includes('40') && html.includes('42'), html.slice(0, 200));
      assert('RcHistoryDetail affiche l\'XP gagnée pendant la session', html.includes('345'), html.slice(0, 200));
      assert('RcHistoryDetail liste les objets ramassés pendant la session', html.includes('ObjetHistoTest'), html.slice(0, 200));
      // session sans objet : message "aucun objet", pas de liste fantôme
      ReactDOM.flushSync(() => root.render(React.createElement(RcHistoryDetail, { session: { levelBefore: 5, levelAfter: 5, xp: 0, items: [] } })));
      assert('RcHistoryDetail affiche un message quand aucun objet n\'a été trouvé', /aucun objet|no item/i.test(container.innerHTML), container.innerHTML.slice(0, 200));
    } finally {
      root.unmount();
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

  // Boss de zone Gahaz (zone 8, "Repaire Bandits Gahaz") -- 2026-07-13, demande explicite : PREMIER
  // monstre du jeu avec une capacité de combat DÉDIÉE (téléportation) au-delà du simple bump
  // générique de pack alpha. Voir GAHAZ_*/spawnPackNear/pickGahazTeleportSpot/gahazBossTeleport
  // (core/game-core.js). Scope volontairement restreint à zoneIdx===8 && alpha -- ces tests
  // vérifient explicitement qu'une AUTRE zone avec un pack alpha n'est PAS affectée.
  function testGahazBossGetsExtraHpDmgMultOnTopOfGenericAlpha() {
    if (typeof spawnPackNear !== 'function') return;
    const s = { zoneIdx, packs, packSerial, Px: P.x, Py: P.y };
    try {
      P.x = 0; P.y = 0;
      // packSerial=4 -> le prochain spawnPackNear() incrémente à 5 -> alpha (packSerial % 5 === 0)
      zoneIdx = 8; packs = []; packSerial = 4;
      spawnPackNear();
      const gahazPack = packs[0];
      zoneIdx = 3; packs = []; packSerial = 4; // Camp Rhutum : zone "normale", même mécanique alpha générique
      spawnPackNear();
      const normalAlphaPack = packs[0];
      assert('Pack alpha zone 8 (Gahaz) marqué gahazBoss', gahazPack.alpha === true && gahazPack.gahazBoss === true);
      assert('Pack alpha zone 3 (normale, hors scope) N\'EST PAS marqué gahazBoss',
        normalAlphaPack.alpha === true && normalAlphaPack.gahazBoss !== true);
      const zGahaz = ZONES[8];
      const genericAlphaHp = zGahaz.hpPer * 2.6, genericAlphaDmg = zGahaz.dmg * 1.8;
      assert('Le boss Gahaz a plus de PV que le simple bump alpha générique (x2.6)',
        gahazPack.wolves[0].maxHp > genericAlphaHp * 1.05,
        `hp=${gahazPack.wolves[0].maxHp}, alpha générique seul=${genericAlphaHp}`);
      assert('Le boss Gahaz a un bump de PV conservateur (1.3x-1.6x par-dessus l\'alpha générique, pas 3x+)',
        gahazPack.wolves[0].maxHp <= genericAlphaHp * 1.6 + 1e-6,
        `hp=${gahazPack.wolves[0].maxHp}, plafond=${genericAlphaHp*1.6}`);
      assert('Le boss Gahaz inflige plus de dégâts que le simple bump alpha générique (x1.8)',
        gahazPack.dmg > genericAlphaDmg * 1.05, `dmg=${gahazPack.dmg}, alpha générique seul=${genericAlphaDmg}`);
    } finally {
      zoneIdx = s.zoneIdx; packs = s.packs; packSerial = s.packSerial; P.x = s.Px; P.y = s.Py;
    }
  }

  function testPickGahazTeleportSpotStaysWithinConfiguredRingAroundPlayer() {
    if (typeof pickGahazTeleportSpot !== 'function') return;
    let allWithin = true, minSeen = Infinity, maxSeen = 0;
    for (let i = 0; i < 200; i++) {
      const spot = pickGahazTeleportSpot(500, -300);
      const d = Math.hypot(spot.x-500, spot.y-(-300));
      minSeen = Math.min(minSeen, d); maxSeen = Math.max(maxSeen, d);
      if (d < GAHAZ_TELEPORT_MIN_DIST - .01 || d > GAHAZ_TELEPORT_MAX_DIST + .01) allWithin = false;
    }
    assert('pickGahazTeleportSpot reste toujours dans l\'anneau [MIN_DIST, MAX_DIST] autour du joueur (200 tirages)',
      allWithin, `min=${minSeen}, max=${maxSeen}`);
  }

  function testGahazBossTeleportMovesPackSpawnsVfxAndResetsCooldown() {
    if (typeof gahazBossTeleport !== 'function') return;
    const s = { particles, Px: P.x, Py: P.y };
    try {
      particles = [];
      P.x = 0; P.y = 0;
      const pack = { x:1000, y:1000, gahazBoss:true, teleportCd:0,
        wolves:[{dead:false,teleportChargeT:.4},{dead:false,teleportChargeT:.4}] };
      const before = { x:pack.x, y:pack.y };
      gahazBossTeleport(pack);
      const dNew = Math.hypot(pack.x-P.x, pack.y-P.y);
      assert('gahazBossTeleport déplace bien le pack', pack.x !== before.x || pack.y !== before.y);
      assert('gahazBossTeleport atterrit dans l\'anneau configuré autour du joueur',
        dNew >= GAHAZ_TELEPORT_MIN_DIST-.5 && dNew <= GAHAZ_TELEPORT_MAX_DIST+.5, `d=${dNew}`);
      assert('gahazBossTeleport pousse des particules VFX (traînée + éclats aux 2 points)',
        particles.length >= 3, `n=${particles.length}`);
      assert('gahazBossTeleport relance le cooldown (> 0)', pack.teleportCd > 0);
      assert('gahazBossTeleport remet teleportChargeT à 0 sur les monstres vivants',
        pack.wolves.every(w => w.teleportChargeT === 0));
    } finally {
      particles = s.particles; P.x = s.Px; P.y = s.Py;
    }
  }

  // Test d'intégration : le VRAI point d'entrée (wolvesTick, appelé chaque frame de combat) doit
  // bien déclencher gahazBossTeleport quand le cooldown expire sur un pack aggro -- pas seulement
  // la fonction isolée ci-dessus (protège contre un branchement oublié/cassé dans wolvesTick).
  function testWolvesTickTriggersGahazTeleportWhenCooldownExpiresOnAggroPack() {
    if (typeof wolvesTick !== 'function') return;
    const s = { packs, target, Px: P.x, Py: P.y, particles, faint: P.faint };
    try {
      P.faint = 0; particles = [];
      P.x = 0; P.y = 0;
      const pack = { x:100, y:0, dead:false, aggro:true, gathered:1, dmg:1, gahazBoss:true, teleportCd:0,
        wolves:[{ ox:0,oy:0,gx:0,gy:0, hp:99999,maxHp:99999, dead:false, scale:1, tone:'#fff',
          atkT:99, lunge:0, teleportChargeT:0 }] };
      packs = [pack];
      const before = { x:pack.x, y:pack.y };
      wolvesTick(0.016);
      assert('wolvesTick déclenche le teleport du boss Gahaz quand son cooldown expire',
        pack.x !== before.x || pack.y !== before.y, `avant=(${before.x},${before.y}) après=(${pack.x},${pack.y})`);
      assert('Le cooldown est relancé après un teleport déclenché par wolvesTick', pack.teleportCd > 0);
    } finally {
      packs = s.packs; target = s.target; P.x = s.Px; P.y = s.Py; particles = s.particles; P.faint = s.faint;
    }
  }

  // Verrou multi-session (2026-07-10, demande explicite : "Interdire multionglet, multi navigateur
  // and multidevice") -- advanceSim() (game-core.js) doit ignorer TOUT effet de bord (spawn, fsm,
  // caméra...) tant que sessionLocked est vrai (posé par checkPlayerSession(), game-supabase.js,
  // dès qu'une AUTRE session a pris le relais sur ce compte). Test dynamique via le mouvement de
  // caméra (cam.x suit P.x avec un lerp) plutôt que le spawn de packs (dépendrait de
  // targetPackCount()/zoneIdx, plus fragile).
  function testAdvanceSimSkipsAllEffectsWhenSessionLocked() {
    if (typeof advanceSim !== 'function' || typeof sessionLocked === 'undefined') return;
    const savedLocked = sessionLocked, savedCamX = cam.x, savedPx = P.x, savedLast = last, savedReady = saveReady;
    try {
      // saveReady forcé à true : ce test porte sur le verrou MULTI-SESSION, pas sur la garde
      // "aucune simulation tant que la sauvegarde n'est pas connue" (advanceSim, 2026-07-22), qui
      // sortirait avant et rendrait les assertions vertes pour la mauvaise raison.
      saveReady = true;
      P.x = 500; cam.x = 0; sessionLocked = true;
      advanceSim(performance.now() + 50);
      assert('advanceSim() ne bouge pas la caméra tant que sessionLocked est vrai (verrou multi-session)', cam.x === 0, `cam.x=${cam.x}`);
      sessionLocked = false;
      advanceSim(performance.now() + 150);
      assert('advanceSim() reprend normalement une fois sessionLocked repassé à false', cam.x > 0, `cam.x=${cam.x}`);
    } finally {
      sessionLocked = savedLocked; cam.x = savedCamX; P.x = savedPx; last = savedLast; saveReady = savedReady;
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
  // reskin écran de connexion (2026-07-21, port fidèle du mockup #authBox validé par
  // l'utilisateur, voir CLAUDE.md section mockups) -- #authBox n'avait jamais été touché par la
  // refonte visuelle "Zone" (topbar/tabs) et restait sur l'ancien thème hérité par accident
  // (font-family:inherit -> body{font-family:Georgia}, --panel/--gold-dim, border-radius:0
  // partout). Garde-fou statique sur le DOM/CSS réellement appliqué (pas juste une relecture du
  // fichier styles.css) : empêche tout retour silencieux vers l'ancien thème lors d'un futur
  // remaniement CSS de cette carte.
  function testAuthBoxUsesZoneRedesignTokens() {
    const box = document.getElementById('authBox');
    const h1 = box && box.querySelector('h1');
    const input = document.getElementById('authEmail');
    if (!box || !h1 || !input) return; // hors-contexte navigateur / DOM pas encore prêt
    const boxStyle = getComputedStyle(box);
    const h1Style = getComputedStyle(h1);
    const inputStyle = getComputedStyle(input);
    assert('#authBox a un radius de carte (>=12px, cohérent avec .confirmModal/.card) et non plus 0 (thème Georgia)',
      parseFloat(boxStyle.borderRadius) >= 12, boxStyle.borderRadius);
    assert('#authBox utilise Inter (plus hérité de body{font-family:Georgia})',
      boxStyle.fontFamily.toLowerCase().includes('inter'), boxStyle.fontFamily);
    assert('#authBox h1 utilise Cinzel (même famille que .topbar .logo)',
      h1Style.fontFamily.toLowerCase().includes('cinzel'), h1Style.fontFamily);
    assert('#authBox input a un radius (>=6px, cohérent avec le reste des inputs Zone)',
      parseFloat(inputStyle.borderRadius) >= 6, inputStyle.borderRadius);
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

  // ---------- reskin coque #infoBox (2026-07-12) ----------
  // #infoBox/#infoHead/#infoBody est la coque MODALE GÉNÉRIQUE partagée par Quêtes/Courrier/
  // Codex/repli Wiki/repli Notes de version — garde-fou contre un retour à l'ancien thème
  // (font-family:Georgia hérité de body, fond var(--panel), bordure var(--gold-dim), en-tête en
  // dégradé bleu-vert #26313a->#1b232a) si une règle CSS future écrase le reskin sans qu'on s'en
  // aperçoive visuellement (voir Phase 6, styles.css, mockup validé par l'utilisateur).
  function testInfoBoxSharedShellUsesZoneRedesignTokens() {
    openInfo('Test', '<h3>Titre</h3><p>Texte</p>');
    const box = getComputedStyle($('infoBox'));
    const head = getComputedStyle($('infoHead'));
    const h2 = getComputedStyle($('infoTitle'));
    const close = getComputedStyle($('closeInfo'));
    const body = getComputedStyle($('infoBody'));
    const h3 = getComputedStyle($('infoBody').querySelector('h3'));
    assert('infoBox fond var(--s1) #10101e (plus var(--panel))', box.backgroundColor === 'rgb(16, 16, 30)', box.backgroundColor);
    assert('infoBox border-radius 12px (plus 0)', box.borderRadius === '12px', box.borderRadius);
    assert('infoHead sans le vieux dégradé bleu-vert (plus de background-image)', head.backgroundImage === 'none', head.backgroundImage);
    assert('infoHead h2 en Cinzel', h2.fontFamily.indexOf('Cinzel') === 0, h2.fontFamily);
    assert('infoHead h2 en --gold2 #e8c880 (plus --ink)', h2.color === 'rgb(232, 200, 128)', h2.color);
    assert('closeInfo redimensionné en bouton icône 26x26 (plus texte brut sans fond)', close.width === '26px' && close.height === '26px', `${close.width}x${close.height}`);
    assert('infoBody en Inter (plus l\'héritage Georgia du body)', body.fontFamily.indexOf('Inter') === 0, body.fontFamily);
    assert('infoBody h3 en --gold2 petites majuscules (plus --gold sans transform)', h3.color === 'rgb(232, 200, 128)' && h3.textTransform === 'uppercase', `${h3.color}/${h3.textTransform}`);
    $('infoOverlay').classList.remove('open');
  }

  // le comparateur avant/après des notes de version (#patchImgBox) partage la même coque que
  // #infoBox (voir commentaire Phase 6, styles.css) -- même garde-fou.
  function testPatchImgBoxReusesInfoBoxShell() {
    if (typeof openPatchImgCompare !== 'function') { assert('openPatchImgCompare disponible', false, 'fonction absente'); return; }
    openPatchImgCompare('a.png', 'b.png');
    const box = getComputedStyle($('patchImgBox'));
    assert('patchImgBox reprend le fond var(--s1) de infoBox', box.backgroundColor === 'rgb(16, 16, 30)', box.backgroundColor);
    assert('patchImgBox reprend le border-radius 12px de infoBox', box.borderRadius === '12px', box.borderRadius);
    $('patchImgOverlay').classList.remove('open');
  }

  // ---------- réorganisation du centre de notifications (2026-07-2x, port du mockup validé) ----------
  // helper commun : sauvegarde/restaure l'état global mutable touché par ces tests (S.notifLog,
  // S.notifLastSeenTs, notifCatFilter, notifSearchQuery, notifExpandedGroups, notifClearArm,
  // notifCenterOpen) -- sans ça, un test qui ouvre le panneau ou vide une catégorie polluerait les
  // tests suivants ET la vraie session de jeu en cours.
  function withNotifState(fn) {
    const savedLog = S.notifLog, savedSeen = S.notifLastSeenTs, savedCat = notifCatFilter,
      savedSearch = notifSearchQuery, savedExpanded = notifExpandedGroups, savedArm = notifClearArm,
      savedOpen = notifCenterOpen;
    try { fn(); } finally {
      S.notifLog = savedLog; S.notifLastSeenTs = savedSeen; notifCatFilter = savedCat;
      notifSearchQuery = savedSearch; notifExpandedGroups = savedExpanded; notifClearArm = savedArm;
      notifCenterOpen = savedOpen;
      if ($a('infoOverlay').classList.contains('open')) $a('infoOverlay').classList.remove('open');
      updateNotifBadge();
    }
  }
  function fakeNotif(icon, title, text, cat, t) {
    return { id: 'test_' + Math.random(), icon, title, text, t, cat };
  }

  function testGroupNotifEntriesGroupsInfoAtThresholdButNeverSuccessOrImportant() {
    withNotifState(() => {
      const now = Date.now();
      // 3x la même notif 'info' (niveau supérieur) le même jour -> doit se grouper
      const items = [
        fakeNotif('⭐', 'Niveau supérieur', 'Niveau 9 atteint', 'info', now),
        fakeNotif('⭐', 'Niveau supérieur', 'Niveau 8 atteint', 'info', now - 1000),
        fakeNotif('⭐', 'Niveau supérieur', 'Niveau 7 atteint', 'info', now - 2000),
      ];
      const groups = groupNotifEntries(items);
      assert('groupNotifEntries : 3 notifs info identiques le même jour -> 1 seul groupe', groups.length === 1 && !groups[0].single, JSON.stringify(groups.map(g=>g.single?'single':g.entries.length)));
      assert('groupNotifEntries : le groupe contient les 3 entrées, la plus récente en premier', groups[0].entries && groups[0].entries[0].text === 'Niveau 9 atteint', groups[0].entries && groups[0].entries.map(e=>e.text));

      // seulement 2 répétitions -> sous le seuil, reste 2 lignes seules
      const under = [
        fakeNotif('⭐', 'Niveau supérieur', 'Niveau 5 atteint', 'info', now),
        fakeNotif('⭐', 'Niveau supérieur', 'Niveau 4 atteint', 'info', now - 1000),
      ];
      const underGroups = groupNotifEntries(under);
      assert('groupNotifEntries : 2 répétitions (< NOTIF_GROUP_MIN) restent des lignes seules', underGroups.length === 2 && underGroups.every(g=>g.single), JSON.stringify(underGroups));

      // 3x la même notif 'success' (succès débloqué, titre identique par construction) -> jamais groupée
      const successItems = [
        fakeNotif('🏅', 'Succès débloqué', 'Premier sang', 'success', now),
        fakeNotif('🏅', 'Succès débloqué', 'Chasseur', 'success', now - 1000),
        fakeNotif('🏅', 'Succès débloqué', 'Vétéran', 'success', now - 2000),
      ];
      const successGroups = groupNotifEntries(successItems);
      assert('groupNotifEntries : les entrées "success" ne sont JAMAIS groupées (événements rares, toujours individuels)', successGroups.length === 3 && successGroups.every(g=>g.single), JSON.stringify(successGroups));
    });
  }

  function testNotifDayKeyMatchesChatDayGrouping() {
    // notifDayKey/notifDayLabel réutilisent EXACTEMENT dayKeyOf/fmtDaySeparator (social/chat.js) --
    // ce test empêche une divergence silencieuse si l'un des deux fichiers est modifié séparément.
    const ts = Date.now() - 3 * 3600 * 1000;
    const iso = new Date(ts).toISOString();
    assert('notifDayKey(ts) === dayKeyOf(iso) (même regroupement par jour que le chat)', notifDayKey(ts) === dayKeyOf(iso), `${notifDayKey(ts)} vs ${dayKeyOf(iso)}`);
    assert('notifDayLabel(ts) === fmtDaySeparator(iso)', notifDayLabel(ts) === fmtDaySeparator(iso), `${notifDayLabel(ts)} vs ${fmtDaySeparator(iso)}`);
  }

  function testComputeNotifUnreadCountDerivesFromLastSeenTsNotACounter() {
    withNotifState(() => {
      const now = Date.now();
      S.notifLastSeenTs = now - 5000;
      S.notifLog = [
        fakeNotif('🏅', 'Succès débloqué', 'a', 'success', now),       // après lastSeenTs -> non lue
        fakeNotif('🎭', 'Mode invité', 'b', 'info', now - 10000),      // avant -> déjà vue
        fakeNotif('⚠️', 'Alerte', 'c', 'important', now - 1000),       // après -> non lue
      ];
      assert('computeNotifUnreadCount() : 2 entrées postérieures à notifLastSeenTs sur 3', computeNotifUnreadCount() === 2, computeNotifUnreadCount());
      assert('computeNotifUnreadCount("important") : filtre bien par catégorie', computeNotifUnreadCount('important') === 1, computeNotifUnreadCount('important'));
      assert('computeNotifUnreadCount("info") : la notif "vue" (avant lastSeenTs) ne compte pas', computeNotifUnreadCount('info') === 0, computeNotifUnreadCount('info'));
    });
  }

  function testEnsureNotifLastSeenMigratesExistingLogToSeenButFreshLogToZero() {
    withNotifState(() => {
      // sauvegarde "ancienne" (avant l'ajout du champ) : déjà des entrées dans le journal --
      // doit devenir "déjà tout vu" (pas de flot de points nouveau rétroactifs), pas 0.
      S.notifLastSeenTs = undefined;
      S.notifLog = [fakeNotif('🏅', 'x', 'y', 'success', Date.now() - 100000)];
      ensureNotifLastSeen();
      assert('ensureNotifLastSeen : sauvegarde existante avec historique -> notifLastSeenTs proche de maintenant (tout considéré déjà vu)', Date.now() - S.notifLastSeenTs < 2000, S.notifLastSeenTs);

      // compte tout neuf : journal vide -> part de 0 (la 1ère notif s'affichera bien comme nouvelle)
      S.notifLastSeenTs = undefined;
      S.notifLog = [];
      ensureNotifLastSeen();
      assert('ensureNotifLastSeen : journal vide (nouveau compte) -> notifLastSeenTs = 0', S.notifLastSeenTs === 0, S.notifLastSeenTs);
    });
  }

  function testOpeningNotifCenterKeepsUnreadUntilRealClose() {
    withNotifState(() => {
      S.notifLastSeenTs = Date.now() - 60000;
      S.notifLog = [fakeNotif('🏅', 'Succès débloqué', 'test', 'success', Date.now())];
      updateNotifBadge();
      assert('avant ouverture : 1 notification non lue', notifUnread === 1, notifUnread);
      openNotifCenter();
      assert('pendant que le panneau est OUVERT : le badge reste à 1 (pas remis à 0 à l\'ouverture, sinon plus aucun moyen de voir ce qui est vraiment nouveau)', notifUnread === 1, notifUnread);
      const dotPresent = $a('infoBody').querySelector('.ncNewDot');
      assert('pendant que le panneau est ouvert : le point "nouveau" est toujours affiché sur la ligne', !!dotPresent, 'ncNewDot absent');
      // simule la fermeture RÉELLE (closeInfoOverlay() appelle leaveNotifCenterIfOpen())
      leaveNotifCenterIfOpen();
      assert('après la fermeture RÉELLE du panneau : le badge repasse à 0', notifUnread === 0, notifUnread);
    });
  }

  function testMarkAllNotifReadClearsBadgeButKeepsLogEntries() {
    withNotifState(() => {
      S.notifLastSeenTs = Date.now() - 60000;
      S.notifLog = [fakeNotif('⭐', 'Niveau supérieur', 'Niveau 5', 'info', Date.now())];
      updateNotifBadge();
      assert('avant "Tout marquer lu" : 1 non lue', notifUnread === 1, notifUnread);
      markAllNotifRead();
      assert('"Tout marquer lu" : badge à 0 immédiatement', notifUnread === 0, notifUnread);
      assert('"Tout marquer lu" : l\'entrée reste dans S.notifLog (non destructif)', S.notifLog.length === 1, S.notifLog.length);
    });
  }

  function testHandleNotifClearScopesToDisplayedCategoryOnlyWithTwoClickConfirm() {
    withNotifState(() => {
      const now = Date.now();
      S.notifLog = [
        fakeNotif('🏅', 'Succès débloqué', 'a', 'success', now),
        fakeNotif('🎭', 'Mode invité', 'b', 'info', now),
      ];
      notifCatFilter = 'success';
      notifClearArm = null;
      handleNotifClearClick(); // 1er clic : arme la confirmation, ne supprime rien encore
      assert('1er clic sur "Vider" : rien supprimé, juste armé', S.notifLog.length === 2, S.notifLog.length);
      assert('1er clic : notifClearArm armé pour la catégorie affichée', !!notifClearArm && notifClearArm.cat === 'success', JSON.stringify(notifClearArm));
      handleNotifClearClick(); // 2e clic (dans la fenêtre de 3s) : confirme
      assert('2e clic : seule la catégorie "success" est vidée', S.notifLog.length === 1 && S.notifLog[0].cat === 'info', JSON.stringify(S.notifLog));
    });
  }

  function testNotifActionButtonOnlyRendersForGuestModeIcon() {
    withNotifState(() => {
      const guestRow = notifRowHtml(fakeNotif('🎭', 'Mode invité', 'test', 'info', Date.now()));
      assert('la notification "Mode invité" (icône 🎭) affiche un bouton d\'action contextuel', guestRow.includes('ncActionBtn'), guestRow);
      const levelRow = notifRowHtml(fakeNotif('⭐', 'Niveau supérieur', 'Niveau 5', 'info', Date.now()));
      assert('une notification sans action mappée (icône ⭐) n\'affiche PAS de bouton d\'action', !levelRow.includes('ncActionBtn'), levelRow);
    });
  }

  function testNotifRailShowsPerCategoryUnreadCounts() {
    withNotifState(() => {
      const now = Date.now();
      S.notifLastSeenTs = now - 60000;
      S.notifLog = [
        fakeNotif('🏅', 'Succès débloqué', 'a', 'success', now),
        fakeNotif('⚠️', 'Alerte', 'b', 'important', now - 100000), // déjà vue (avant lastSeenTs)
      ];
      openNotifCenter();
      const railItems = [...$a('infoBody').querySelectorAll('.ncRailItem')];
      const successItem = railItems.find(el => el.dataset.cat === 'success');
      const importantItem = railItems.find(el => el.dataset.cat === 'important');
      assert('rail : catégorie "Réussites" affiche 1 non lue', !!successItem && successItem.querySelector('.ncRailCount').textContent.trim() === '1', successItem && successItem.textContent);
      assert('rail : catégorie "Important" affiche 0 (entrée déjà vue avant notifLastSeenTs)', !!importantItem && importantItem.querySelector('.ncRailCount').textContent.trim() === '0', importantItem && importantItem.textContent);
      leaveNotifCenterIfOpen();
    });
  }

  function testHandleNotifClearArmedButtonAutoRevertsFieldNotUsedElsewhere() {
    // garde-fou statique (pas de vrai setTimeout de 3s dans la suite de tests) : vérifie que
    // handleNotifClearClick() pose bien un expiresAt futur au 1er clic, condition nécessaire pour
    // que le revert automatique (setTimeout dans la fonction réelle) fonctionne.
    withNotifState(() => {
      notifCatFilter = 'all';
      notifClearArm = null;
      const before = Date.now();
      handleNotifClearClick();
      assert('1er clic "Vider" : expiresAt posé dans le futur (~3s)', !!notifClearArm && notifClearArm.expiresAt > before + 2500 && notifClearArm.expiresAt <= before + 3500, JSON.stringify(notifClearArm));
    });
  }

  // garde-fou du reskin #sessionLockBox (2026-07-12, mockup validé : claude.ai/code/artifact/
  // c6ea1bee-8162-4705-a9f4-cb5c5649fa84) -- vérifie le rendu RÉEL via getComputedStyle (résolu
  // même sur un ancêtre display:none, seules les valeurs dépendant du layout comme offsetWidth ne
  // le seraient pas) plutôt qu'une simple relecture du CSS source, pour ne pas revenir aux
  // anciens tokens (fond var(--panel), radius:0, Georgia hérité, bouton radius:4px) sans qu'aucun
  // test ne le détecte.
  function testSessionLockBoxUsesZoneRedesignTokens() {
    const box = document.getElementById('sessionLockBox');
    const h1 = box && box.querySelector('h1');
    const btn = document.getElementById('sessionLockResumeBtn');
    if (!box || !h1 || !btn) { assert('sessionLockBox reskin : markup présent', false, 'élément(s) manquant(s)'); return; }
    const cs = getComputedStyle(box), csh1 = getComputedStyle(h1), csbtn = getComputedStyle(btn);
    assert('sessionLockBox : radius 14px (mêmes tokens que #authBox/.confirmModal)', cs.borderRadius === '14px', `borderRadius=${cs.borderRadius}`);
    assert('sessionLockBox : police Inter (plus Georgia hérité de body)', /Inter/.test(cs.fontFamily), `fontFamily=${cs.fontFamily}`);
    assert('sessionLockBox h1 : police Cinzel (comme les autres titres de panneau)', /Cinzel/.test(csh1.fontFamily), `fontFamily=${csh1.fontFamily}`);
    assert('sessionLockResumeBtn : radius 8px (cohérent avec les autres CTA, plus 4px isolé)', csbtn.borderRadius === '8px', `borderRadius=${csbtn.borderRadius}`);
  }

  // garde-fou du reskin .achToast/#updateToast (2026-07-12, mockup validé : claude.ai/code/
  // artifact/85d689a7-c5f1-4361-8114-a6f822f45c87) -- ces deux toasts n'avaient jamais suivi la
  // refonte Zone (.achToast en fond #1c1a22/bordure --gold-dim/radius 6px/Georgia hérité,
  // #updateToast en var(--panel-2)/--gold/bouton carré). Vérifie le rendu RÉEL via
  // getComputedStyle plutôt qu'une simple relecture du CSS source, même pattern que
  // testSessionLockBoxUsesZoneRedesignTokens ci-dessus. .achToast n'existe qu'à la création d'un
  // toast (showAchToast()) : on en crée un jetable pour le test, puis on le retire du DOM pour ne
  // pas laisser de résidu (pas d'appel à markPenMastery/logToDiscord ici, juste la fonction de
  // rendu pure).
  function testToastsUseZoneRedesignTokens() {
    if (typeof showAchToast !== 'function') { assert('achToast reskin : showAchToast disponible', false, 'fonction manquante'); return; }
    const stack = document.getElementById('achToastStack');
    if (!stack) { assert('achToast reskin : #achToastStack présent', false, 'élément manquant'); return; }
    const before = stack.children.length;
    showAchToast({ icon:'🗡️', name:{ fr:'Test', en:'Test' }, reward:1 });
    const toastEl = stack.lastElementChild;
    const titleEl = toastEl && toastEl.querySelector('.achToastTitle');
    const nameEl = toastEl && toastEl.querySelector('.achToastName');
    const rewardEl = toastEl && toastEl.querySelector('.achToastReward');
    if (!toastEl || !titleEl || !nameEl || !rewardEl) {
      assert('achToast reskin : markup présent', false, 'élément(s) manquant(s)');
    } else {
      const cs = getComputedStyle(toastEl), cst = getComputedStyle(titleEl), csn = getComputedStyle(nameEl), csr = getComputedStyle(rewardEl);
      assert('achToast : radius 10px (mêmes tokens que .card)', cs.borderRadius === '10px', `borderRadius=${cs.borderRadius}`);
      assert('achToast : police Inter (plus Georgia hérité de body)', /Inter/.test(cs.fontFamily), `fontFamily=${cs.fontFamily}`);
      assert('achToastTitle : police Cinzel petites majuscules (comme .card h3)', /Cinzel/.test(cst.fontFamily) && cst.textTransform === 'uppercase', `fontFamily=${cst.fontFamily} textTransform=${cst.textTransform}`);
      assert('achToastName : reste lisible en Inter/--ink', /Inter/.test(csn.fontFamily), `fontFamily=${csn.fontFamily}`);
      assert('achToastReward : police JetBrains Mono (plus Georgia)', /JetBrains Mono/.test(csr.fontFamily), `fontFamily=${csr.fontFamily}`);
    }
    // nettoyage : retire le toast jetable, ne pas laisser de résidu dans le DOM entre deux runs
    if (toastEl) toastEl.remove();
    assert('achToast reskin : pas de résidu après nettoyage', stack.children.length === before, `children=${stack.children.length}`);

    const upd = document.getElementById('updateToast');
    const updBtn = upd && upd.querySelector('button');
    if (!upd || !updBtn) { assert('updateToast reskin : markup présent', false, 'élément(s) manquant(s)'); return; }
    const csu = getComputedStyle(upd), csb = getComputedStyle(updBtn);
    assert('updateToast : radius 10px (mêmes tokens que .card, plus var(--panel-2) en dur)', csu.borderRadius === '10px', `borderRadius=${csu.borderRadius}`);
    assert('updateToast : police Inter', /Inter/.test(csu.fontFamily), `fontFamily=${csu.fontFamily}`);
    assert('updateToast button : radius 8px (cohérent avec les autres CTA, plus carré)', csb.borderRadius === '8px', `borderRadius=${csb.borderRadius}`);
  }
  // garde-fou du reskin .pdSlot/#equipSummary (2026-07-12, mockup validé : claude.ai/code/artifact/
  // 0c7bfa65-d046-4d4c-9541-232b14313e7a) -- même méthode que testSessionLockBoxUsesZoneRedesignTokens :
  // getComputedStyle sur du markup RÉELLEMENT présent au chargement (#crystalSlotCenter porte déjà
  // la classe .pdSlot en statique, #equipSummary aussi), pas une simple relecture du CSS source.
  // Vérifie aussi que les couleurs sémantiques des sous-éléments (Niv blanc / XP doré / GS bleu)
  // et les états .filled/.empty du paperdoll (hors périmètre de ce reskin) restent inchangés.
  function testEquipmentPaperdollUsesZoneRedesignTokens() {
    const slot = document.getElementById('crystalSlotCenter');
    const summary = document.getElementById('equipSummary');
    const lvl = document.getElementById('eqSumLvl');
    const xp = document.getElementById('eqSumXp');
    const gs = document.getElementById('eqSumGs');
    if (!slot || !summary || !lvl || !xp || !gs) { assert('paperdoll reskin : markup présent', false, 'élément(s) manquant(s)'); return; }
    const csSlot = getComputedStyle(slot), csSummary = getComputedStyle(summary);
    const csLvl = getComputedStyle(lvl), csXp = getComputedStyle(xp), csGs = getComputedStyle(gs);
    assert('.pdSlot : bordure --dbBorder rgb(42,42,68) (plus #3a3742 en dur)', csSlot.borderTopColor === 'rgb(42, 42, 68)', csSlot.borderTopColor);
    assert('.pdSlot : radius 7px (plus coins carrés)', csSlot.borderRadius === '7px', csSlot.borderRadius);
    assert('.pdSlot : fond --s2 rgb(24,24,40) (plus rgba(20,19,26,.9))', csSlot.backgroundColor === 'rgb(24, 24, 40)', csSlot.backgroundColor);
    assert('#equipSummary : bordure --dbBorder rgb(42,42,68) (plus --gold-dim)', csSummary.borderTopColor === 'rgb(42, 42, 68)', csSummary.borderTopColor);
    assert('#equipSummary : radius 8px (plus 4px)', csSummary.borderRadius === '8px', csSummary.borderRadius);
    assert('#equipSummary : fond --s2 rgb(24,24,40) (plus rgba(201,165,90,.05))', csSummary.backgroundColor === 'rgb(24, 24, 40)', csSummary.backgroundColor);
    assert('#equipSummary : police JetBrains Mono (plus héritée)', /JetBrains Mono/.test(csSummary.fontFamily), csSummary.fontFamily);
    assert('#eqSumLvl reste blanc (couleur sémantique inchangée)', csLvl.color === 'rgb(255, 255, 255)', csLvl.color);
    assert('#eqSumXp reste doré --gold (couleur sémantique inchangée)', csXp.color === 'rgb(201, 165, 90)', csXp.color);
    assert('#eqSumGs reste bleu #9cc9e8 (couleur sémantique inchangée)', csGs.color === 'rgb(156, 201, 232)', csGs.color);
  }
  // garde-fou du reskin .sk (barre de sorts) + #potSelect (sélecteur de potion) -- 2026-07-12,
  // port fidèle du mockup validé (claude.ai/code/artifact/254bf55f-d00b-4a15-a0d3-441876371a98).
  // Ces 2 éléments avaient été oubliés par les phases précédentes de la refonte Zone : .sk gardait
  // le dégradé gris #22202a->#161419 + coins carrés + police héritée Georgia, #potSelect gardait
  // un fond noir en dur rgba(12,10,15,.95) + bordure --gold-dim + radius 6/4px + police héritée.
  // Vérifie le rendu RÉEL via getComputedStyle (pas juste une relecture de styles.css) et confirme
  // que .cast/.buffed/.sel/.locked (états sémantiques de jeu) restent EXACTEMENT inchangés --
  // seule la coque (fond/bordure/radius/police) doit avoir bougé.
  function testSkillBarAndPotSelectUseZoneRedesignTokens() {
    if (typeof document === 'undefined') return; // hors-contexte navigateur
    const sk = document.querySelector('#skillBar .sk');
    if (!sk) { assert('#skillBar contient au moins un .sk (barre de sorts construite)', false, 'aucun .sk trouvé'); return; }
    const skCs = getComputedStyle(sk);
    const ic = sk.querySelector('.ic'), nm = sk.querySelector('.nm');
    assert('.sk fond var(--s1) #10101e (plus le dégradé gris #22202a->#161419)', skCs.backgroundColor === 'rgb(16, 16, 30)', skCs.backgroundColor);
    assert('.sk bordure var(--dbBorder) #2a2a44 (plus --gold-dim)', skCs.borderColor === 'rgb(42, 42, 68)', skCs.borderColor);
    assert('.sk radius 8px (plus 0, coins carrés d\'origine)', skCs.borderRadius === '8px', skCs.borderRadius);
    assert('.sk police Inter (plus Georgia hérité de body)', /Inter/.test(skCs.fontFamily), skCs.fontFamily);
    assert('.sk .ic teinté --gold2 #e8c880', getComputedStyle(ic).color === 'rgb(232, 200, 128)', getComputedStyle(ic).color);
    assert('.sk .nm police JetBrains Mono (plus héritée)', /JetBrains Mono/.test(getComputedStyle(nm).fontFamily), getComputedStyle(nm).fontFamily);
    assert('.sk .nm couleur --cream3 #585040 (plus --ink-dim)', getComputedStyle(nm).color === 'rgb(88, 80, 64)', getComputedStyle(nm).color);
    // états sémantiques .cast/.buffed inchangés (ajoutés/retirés ici uniquement pour le test)
    sk.classList.add('cast');
    assert('.sk.cast garde sa bordure bleue #9cc9e8 (état sémantique, non touché par le reskin)',
      getComputedStyle(sk).borderColor === 'rgb(156, 201, 232)', getComputedStyle(sk).borderColor);
    sk.classList.remove('cast'); sk.classList.add('buffed');
    assert('.sk.buffed garde sa bordure dorée var(--gold) (état sémantique, non touché par le reskin)',
      getComputedStyle(sk).borderColor === 'rgb(201, 165, 90)', getComputedStyle(sk).borderColor);
    sk.classList.remove('buffed');

    if (typeof renderPotSelect !== 'function') { assert('renderPotSelect disponible', false, 'fonction absente'); return; }
    renderPotSelect();
    const potEl = $('potSelect');
    const potCs = getComputedStyle(potEl);
    assert('#potSelect fond var(--s1) #10101e (plus rgba(12,10,15,.95) en dur)', potCs.backgroundColor === 'rgb(16, 16, 30)', potCs.backgroundColor);
    assert('#potSelect bordure var(--dbBorder) #2a2a44 (plus --gold-dim)', potCs.borderColor === 'rgb(42, 42, 68)', potCs.borderColor);
    assert('#potSelect radius 10px (plus 6px)', potCs.borderRadius === '10px', potCs.borderRadius);
    const row = potEl.querySelector('.psRow[data-pot="medium"]');
    const lbl = potEl.querySelector('.psSectionLabel');
    const heal = potEl.querySelector('.psHeal');
    const cost = potEl.querySelector('.psCost');
    if (!row || !lbl || !heal || !cost) { assert('#potSelect : markup attendu présent (.psRow/.psSectionLabel/.psHeal/.psCost)', false, 'élément(s) manquant(s)'); return; }
    assert('.psRow radius 7px (plus 4px)', getComputedStyle(row).borderRadius === '7px', getComputedStyle(row).borderRadius);
    assert('.psSectionLabel police Cinzel (plus héritée)', /Cinzel/.test(getComputedStyle(lbl).fontFamily), getComputedStyle(lbl).fontFamily);
    assert('.psSectionLabel couleur --cream3 #585040 (plus --ink-dim)', getComputedStyle(lbl).color === 'rgb(88, 80, 64)', getComputedStyle(lbl).color);
    assert('.psSectionLabel petites majuscules (text-transform:uppercase, comme .card h3)', getComputedStyle(lbl).textTransform === 'uppercase', getComputedStyle(lbl).textTransform);
    assert('.psHeal police JetBrains Mono (plus héritée)', /JetBrains Mono/.test(getComputedStyle(heal).fontFamily), getComputedStyle(heal).fontFamily);
    assert('.psCost police JetBrains Mono (plus héritée)', /JetBrains Mono/.test(getComputedStyle(cost).fontFamily), getComputedStyle(cost).fontFamily);
    // couleurs sémantiques inchangées : soin en vert, coût en or, ligne sélectionnée/verrouillée pareilles qu'avant
    assert('.psHeal garde sa couleur verte #8fc98a (couleur sémantique, non touchée par le reskin)',
      getComputedStyle(heal).color === 'rgb(143, 201, 138)', getComputedStyle(heal).color);
    assert('.psCost garde sa couleur dorée var(--gold) (couleur sémantique, non touchée par le reskin)',
      getComputedStyle(cost).color === 'rgb(201, 165, 90)', getComputedStyle(cost).color);
    assert('.psRow[data-pot=medium] (potion par défaut) garde sa classe .sel (état sémantique inchangé)',
      row.classList.contains('sel'), row.className);
    const lockedRow = potEl.querySelector('.psRow.locked');
    if (lockedRow) assert('.psRow.locked garde son opacité .45 (état sémantique inchangé)', getComputedStyle(lockedRow).opacity === '0.45', getComputedStyle(lockedRow).opacity);
  }

  // regression (2026-07-12) : cadre de jeu recadré en 4:5 sur mobile (@media max-width:600px,
  // src/styles/styles.css, object-fit:cover sur #cv) -- garde-fou qui empêche tout futur
  // changement de la RÉSOLUTION INTERNE du canvas #cv pour "régler" un problème d'affichage
  // mobile (règle absolue du projet, CLAUDE.md §18/§25, incident PR #3 : changer la résolution du
  // canvas casserait tout le mapping clic->monde ET le rendu du jeu). Seul le CSS (aspect-ratio +
  // object-fit) doit bouger, jamais les attributs width/height de la balise <canvas id="cv">.
  function testCanvasResolutionNeverChangedByMobileCrop() {
    if (typeof document === 'undefined') return; // hors-contexte navigateur
    assert('#cv garde sa résolution interne width=1240 (jamais modifiée pour le recadrage mobile 4:5)',
      cv.getAttribute('width') === '1240', `width=${cv.getAttribute('width')}`);
    assert('#cv garde sa résolution interne height=440 (jamais modifiée pour le recadrage mobile 4:5)',
      cv.getAttribute('height') === '440', `height=${cv.getAttribute('height')}`);
  }
  // regression (2026-07-12) : mapCanvasClickToWorld() (src/backend/game-supabase.js) doit rester
  // exact que le canvas soit affiché à l'échelle uniforme (desktop, aucun recadrage) OU recadré en
  // object-fit:cover (mobile, cadre 4:5) -- sinon un clic sur un objet au sol se retrouve
  // silencieusement décalé du monde réel, un bug quasi invisible à l'oeil (le perso se déplace
  // "à peu près" au bon endroit visuellement tant qu'on ne compare pas au vrai point cliqué).
  function testMapCanvasClickToWorldDesktopUniformScale() {
    // desktop : rect à échelle uniforme 0.5x (620x220 pour un canvas 1240x440), aucun recadrage --
    // doit se comporter comme l'ancien calcul (clientX - rect.left) * (W / rect.width)
    const rect = { left:0, top:0, width:620, height:220 };
    const center = mapCanvasClickToWorld(rect, 1240, 440, 310, 110);
    assert('desktop (échelle uniforme) : clic au centre du rect retombe au centre du monde (sx=620)',
      Math.abs(center.sx - 620) < 0.001, `sx=${center.sx}`);
    assert('desktop (échelle uniforme) : clic au centre du rect retombe au centre du monde (sy=220)',
      Math.abs(center.sy - 220) < 0.001, `sy=${center.sy}`);
    const topLeft = mapCanvasClickToWorld(rect, 1240, 440, 0, 0);
    assert('desktop (échelle uniforme) : clic au coin haut-gauche du rect retombe en (0,0) monde',
      topLeft.sx === 0 && topLeft.sy === 0, `sx=${topLeft.sx}, sy=${topLeft.sy}`);
  }
  function testMapCanvasClickToWorldMobileCoverCrop() {
    // mobile : rect 4:5 (380x475), object-fit:cover -- le canvas (1240x440, bien plus large que
    // haut) déborde en largeur une fois mis à l'échelle pour remplir la hauteur du cadre, donc
    // recadré symétriquement des 2 côtés. scale = max(380/1240, 475/440) = 475/440 (la hauteur
    // pilote l'échelle) ; 176px de scène (sur 1240) sont coupés de chaque côté (352px visibles,
    // centrés sur 620) -- valeurs attendues calculées à la main, voir commentaire de la tâche.
    const rect = { left:0, top:0, width:380, height:475 };
    const center = mapCanvasClickToWorld(rect, 1240, 440, 190, 237.5);
    assert('mobile (cover 4:5) : clic au centre du rect retombe au centre du monde (sx=620)',
      Math.abs(center.sx - 620) < 0.01, `sx=${center.sx}`);
    assert('mobile (cover 4:5) : clic au centre du rect retombe au centre du monde (sy=220)',
      Math.abs(center.sy - 220) < 0.01, `sy=${center.sy}`);
    const leftEdge = mapCanvasClickToWorld(rect, 1240, 440, 0, 237.5);
    assert('mobile (cover 4:5) : bord GAUCHE du cadre retombe à sx=444, PAS 0 (scène recadrée, 176px coupés de ce côté)',
      Math.abs(leftEdge.sx - 444) < 0.01, `sx=${leftEdge.sx}`);
    const rightEdge = mapCanvasClickToWorld(rect, 1240, 440, 380, 237.5);
    assert('mobile (cover 4:5) : bord DROIT du cadre retombe à sx=796, symétrique du bord gauche',
      Math.abs(rightEdge.sx - 796) < 0.01, `sx=${rightEdge.sx}`);
  }

  // Streak de connexion (2026-07-13, panneau "Mon compte" -- voir CLAUDE.md section dédiée) :
  // updateLoginStreak() (core/game-core.js) compare S.lastActiveDay au jour civil local courant.
  // 3 cas couverts : jours consécutifs -> +1, gap de 2+ jours -> reset à 1, même jour rejoué deux
  // fois dans la même session -> pas de double incrément (idempotent).
  function testUpdateLoginStreakIncrementsOnConsecutiveDays() {
    if (typeof updateLoginStreak !== 'function' || typeof localDayKey !== 'function') return;
    const savedStreak = S.loginStreak, savedDay = S.lastActiveDay;
    try {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      S.loginStreak = 4; S.lastActiveDay = localDayKey(yesterday);
      updateLoginStreak();
      assert('updateLoginStreak() incrémente le streak quand lastActiveDay = hier', S.loginStreak === 5, `loginStreak=${S.loginStreak}`);
      assert('updateLoginStreak() met lastActiveDay à aujourd\'hui après incrément', S.lastActiveDay === localDayKey(), `lastActiveDay=${S.lastActiveDay}`);
    } finally { S.loginStreak = savedStreak; S.lastActiveDay = savedDay; }
  }
  function testUpdateLoginStreakResetsOnGapOfTwoOrMoreDays() {
    if (typeof updateLoginStreak !== 'function' || typeof localDayKey !== 'function') return;
    const savedStreak = S.loginStreak, savedDay = S.lastActiveDay;
    try {
      const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      S.loginStreak = 12; S.lastActiveDay = localDayKey(threeDaysAgo);
      updateLoginStreak();
      assert('updateLoginStreak() remet le streak à 1 après un gap de 2+ jours (pas d\'accumulation frauduleuse)', S.loginStreak === 1, `loginStreak=${S.loginStreak}`);
      // jamais connecté avant (lastActiveDay=null) -- même résultat : streak=1, pas une exception
      S.loginStreak = 0; S.lastActiveDay = null;
      updateLoginStreak();
      assert('updateLoginStreak() démarre à 1 pour une toute première connexion (lastActiveDay null)', S.loginStreak === 1, `loginStreak=${S.loginStreak}`);
    } finally { S.loginStreak = savedStreak; S.lastActiveDay = savedDay; }
  }
  function testUpdateLoginStreakNoOpSameDayReplayed() {
    if (typeof updateLoginStreak !== 'function' || typeof localDayKey !== 'function') return;
    const savedStreak = S.loginStreak, savedDay = S.lastActiveDay;
    try {
      S.loginStreak = 7; S.lastActiveDay = localDayKey();
      updateLoginStreak();
      updateLoginStreak(); // rejoué deux fois le même jour civil (ex: reload de page)
      assert('updateLoginStreak() ne s\'incrémente pas deux fois le même jour', S.loginStreak === 7, `loginStreak=${S.loginStreak}`);
    } finally { S.loginStreak = savedStreak; S.lastActiveDay = savedDay; }
  }
  // Garde-fou statique (2026-07-13) : delete_my_account() -- pas de compte de test Supabase dédié
  // dans cette suite (voir CLAUDE.md section tests), donc pas de vrai appel réseau ici. Vérifie que
  // le flux client (openAccountPanel) n'active le bouton de suppression finale QUE si le pseudo
  // retapé correspond EXACTEMENT, même modèle que les autres garde-fous statiques du fichier
  // (inspection du code source .toString() plutôt qu'un appel réseau réel).
  function testDeleteAccountConfirmGatedByExactPseudoMatch() {
    if (typeof openAccountPanel !== 'function') return;
    const src = openAccountPanel.toString();
    assert('openAccountPanel() n\'active le bouton de suppression finale que si le pseudo retapé correspond EXACTEMENT à myPseudo',
      src.includes("delInput.value !== (myPseudo || '')"), `src contient le gate attendu ? ${src.includes("delBtn.disabled")}`);
    assert('openAccountPanel() appelle bien la RPC delete_my_account (jamais un DELETE direct côté client)',
      src.includes("sb.rpc('delete_my_account')"));
    assert('openAccountPanel() déconnecte le client (signOut) après une suppression réussie',
      src.includes('sb.auth.signOut()'));
  }

  // Cartes du dashboard Zone déplaçables/imbricables (2026-07-13, src/core/card-layout.js) --
  // sanitizeCardLayoutState() et les mutateurs (nest/detach/setActiveTab) sont des fonctions
  // pures, testables sans DOM.
  function testCardLayoutSanitizeAcceptsDefaultState() {
    if (typeof sanitizeCardLayoutState !== 'function') return;
    const def = cardLayoutDefaultState();
    const clean = sanitizeCardLayoutState(def);
    assert('sanitizeCardLayoutState() renvoie tel quel un état par défaut valide', JSON.stringify(clean.order) === JSON.stringify(def.order));
    assert('sanitizeCardLayoutState() garde groups vide pour l\'état par défaut', Object.keys(clean.groups).length === 0);
  }

  // Piège réel à prévenir : un id de carte retiré/renommé plus tard, ou une disposition corrompue
  // à la main dans localStorage, ne doit JAMAIS faire planter le chargement -- repli sur la
  // disposition par défaut (section 26 checklist "migration rétroactive"/"garde-fou").
  function testCardLayoutSanitizeRejectsCorruptState() {
    if (typeof sanitizeCardLayoutState !== 'function') return;
    const casesThatMustFallBackToDefault = [
      null,
      undefined,
      42,
      'not an object',
      {},
      { order: ['statsCard', 'zonesCard', 'unknownRemovedCard', 'lootCard', 'equipCard', 'invCard', 'optCard'] }, // id inconnu
      { order: ['statsCard', 'statsCard', 'zonesCard', 'lootCard', 'equipCard', 'invCard', 'optCard'] }, // doublon
      { order: ['statsCard', 'zonesCard', 'lootCard', 'equipCard', 'invCard'] }, // couverture incomplète (optCard manquant)
      { order: ['statsCard', 'zonesCard', 'lootCard', 'equipCard', 'invCard', 'optCard'], groups: { statsCard: ['statsCard'] } }, // host === guest
      { order: ['statsCard', 'zonesCard', 'lootCard', 'equipCard', 'invCard', 'optCard'], groups: { unknownHost: ['zonesCard'] } }, // host pas top-level
      { order: ['statsCard', 'lootCard', 'equipCard', 'invCard', 'optCard'], groups: { statsCard: ['zonesCard'], zonesCard: ['optCard'] } }, // guest utilisé comme host (2 niveaux)
    ];
    casesThatMustFallBackToDefault.forEach((raw, i) => {
      const clean = sanitizeCardLayoutState(raw);
      assert(`sanitizeCardLayoutState() replie sur la disposition par défaut pour le cas corrompu #${i}`,
        JSON.stringify(clean.order.slice().sort()) === JSON.stringify(CARD_LAYOUT_IDS.slice().sort()) && Object.keys(clean.groups).length === 0,
        JSON.stringify(raw));
    });
  }

  function testCardLayoutSanitizeKeepsValidNestedGroup() {
    if (typeof sanitizeCardLayoutState !== 'function') return;
    const raw = {
      order: ['zonesCard', 'lootCard', 'equipCard', 'invCard', 'optCard', 'adminCard'],
      groups: { equipCard: ['statsCard'] },
      active: { equipCard: 'statsCard' },
    };
    const clean = sanitizeCardLayoutState(raw);
    assert('sanitizeCardLayoutState() garde un groupe valide (statsCard imbriquée dans equipCard)', clean.groups.equipCard && clean.groups.equipCard[0] === 'statsCard');
    assert('sanitizeCardLayoutState() garde l\'onglet actif valide', clean.active.equipCard === 'statsCard');
    assert('sanitizeCardLayoutState() ne duplique pas statsCard dans order (elle est imbriquée)', !clean.order.includes('statsCard'));
  }

  function testCardLayoutSanitizeFixesInvalidActiveTab() {
    if (typeof sanitizeCardLayoutState !== 'function') return;
    const raw = {
      order: ['zonesCard', 'lootCard', 'equipCard', 'invCard', 'optCard', 'adminCard'],
      groups: { equipCard: ['statsCard'] },
      active: { equipCard: 'lootCard' }, // lootCard n'est ni equipCard ni statsCard -- invalide pour ce groupe
    };
    const clean = sanitizeCardLayoutState(raw);
    assert('sanitizeCardLayoutState() replie un onglet actif invalide sur l\'hôte lui-même', clean.active.equipCard === 'equipCard');
  }

  function testCardLayoutNestMovesGuestUnderTargetAndSetsItActive() {
    if (typeof cardLayoutNest !== 'function') return;
    const base = cardLayoutDefaultState();
    const next = cardLayoutNest(base, 'statsCard', 'equipCard');
    assert('cardLayoutNest() retire la carte source de order (elle devient un onglet)', !next.order.includes('statsCard'));
    assert('cardLayoutNest() garde la carte cible dans order', next.order.includes('equipCard'));
    assert('cardLayoutNest() ajoute la carte source aux guests de la cible', (next.groups.equipCard || []).includes('statsCard'));
    assert('cardLayoutNest() rend la carte glissée active dans son nouveau groupe', next.active.equipCard === 'statsCard');
  }

  function testCardLayoutNestFlattensSourceThatWasItselfAHost() {
    if (typeof cardLayoutNest !== 'function') return;
    // statsCard est déjà imbriquée dans zonesCard -- si zonesCard (l'hôte) est à son tour glissée
    // sur equipCard, on ne doit JAMAIS créer une imbrication à 2 niveaux : statsCard doit finir
    // comme onglet direct d'equipCard, au même niveau que zonesCard.
    const base = { order: ['zonesCard', 'lootCard', 'equipCard', 'invCard', 'optCard', 'adminCard'], groups: { zonesCard: ['statsCard'] }, active: { zonesCard: 'zonesCard' } };
    const next = cardLayoutNest(base, 'zonesCard', 'equipCard');
    const clean = sanitizeCardLayoutState(next);
    assert('cardLayoutNest() aplati une imbrication à 2 niveaux : zonesCard et statsCard finissent tous deux onglets d\'equipCard',
      clean.groups.equipCard && clean.groups.equipCard.includes('zonesCard') && clean.groups.equipCard.includes('statsCard'));
    assert('cardLayoutNest() ne laisse plus de groupe orphelin sous zonesCard', !clean.groups.zonesCard);
  }

  function testCardLayoutDetachRestoresStandaloneCardRightAfterHost() {
    if (typeof cardLayoutDetach !== 'function') return;
    const base = cardLayoutNest(cardLayoutDefaultState(), 'statsCard', 'equipCard');
    const detached = cardLayoutDetach(base, 'equipCard');
    assert('cardLayoutDetach() retire le groupe une fois vide', !detached.groups.equipCard);
    assert('cardLayoutDetach() replace la carte détachée dans order', detached.order.includes('statsCard'));
    assert('cardLayoutDetach() replace la carte détachée juste après son ancien hôte', detached.order.indexOf('statsCard') === detached.order.indexOf('equipCard') + 1);
    const clean = sanitizeCardLayoutState(detached);
    assert('cardLayoutDetach() produit un état qui reste valide après sanitize', JSON.stringify(clean.order.slice().sort()) === JSON.stringify(CARD_LAYOUT_IDS.slice().sort()));
  }

  function testCardLayoutDetachTargetsOneSpecificGuestAmongSeveral() {
    // retour utilisateur (2026-07-13) : une croix par nom d'onglet, pas une seule croix globale
    // qui ne détachait que l'onglet ACTIF -- vérifie qu'on peut viser un guest précis même si ce
    // n'est pas celui affiché, et que les autres guests du même groupe restent intacts.
    if (typeof cardLayoutDetach !== 'function') return;
    let st = cardLayoutNest(cardLayoutDefaultState(), 'statsCard', 'equipCard');
    st = cardLayoutNest(st, 'invCard', 'equipCard'); // groupe: hôte equipCard, guests [statsCard, invCard]
    st = cardLayoutSetActiveTab(st, 'equipCard', 'statsCard'); // onglet AFFICHÉ = statsCard
    const detached = cardLayoutDetach(st, 'equipCard', 'invCard'); // mais on démerge invCard, pas l'actif
    assert('cardLayoutDetach(host, tabId) retire uniquement le guest ciblé', !detached.groups.equipCard.includes('invCard'));
    assert('cardLayoutDetach(host, tabId) laisse les autres guests du groupe intacts', detached.groups.equipCard.includes('statsCard'));
    assert('cardLayoutDetach(host, tabId) replace le guest ciblé dans order', detached.order.includes('invCard'));
    assert('cardLayoutDetach(host, tabId) ignore une tentative de détacher l\'hôte lui-même', cardLayoutDetach(st, 'equipCard', 'equipCard').groups.equipCard.length === 2);
  }

  function testCardLayoutReorderSwapsWithNeighborAndNoopsAtEdges() {
    // flèches ◀▶ (2026-07-13, retour utilisateur : "passer une carte ou un groupe de cartes
    // d'un côté ou un autre") -- fonction pure, échange avec le voisin immédiat, no-op en bout
    // de liste (les boutons sont désactivés côté UI, mais la fonction doit rester sûre seule).
    if (typeof cardLayoutReorder !== 'function') return;
    const base = cardLayoutDefaultState(); // ['statsCard','zonesCard','lootCard','equipCard','invCard','optCard','adminCard']
    const moved = cardLayoutReorder(base, 'zonesCard', -1);
    assert('cardLayoutReorder(-1) échange avec le voisin de gauche', JSON.stringify(moved.order.slice(0, 2)) === JSON.stringify(['zonesCard', 'statsCard']));
    const movedRight = cardLayoutReorder(base, 'zonesCard', 1);
    assert('cardLayoutReorder(+1) échange avec le voisin de droite', JSON.stringify(movedRight.order.slice(0, 3)) === JSON.stringify(['statsCard', 'lootCard', 'zonesCard']));
    const noopLeft = cardLayoutReorder(base, 'statsCard', -1);
    assert('cardLayoutReorder(-1) sur le 1er élément est un no-op', JSON.stringify(noopLeft.order) === JSON.stringify(base.order));
    const noopRight = cardLayoutReorder(base, 'adminCard', 1);
    assert('cardLayoutReorder(+1) sur le dernier élément est un no-op', JSON.stringify(noopRight.order) === JSON.stringify(base.order));
    // déplace le GROUPE entier (hostId représente tout le groupe fusionné dans order) --
    // vérifie que ses guests suivent implicitement (ils ne sont pas dans order, seul l'hôte l'est).
    const grouped = cardLayoutNest(base, 'statsCard', 'equipCard'); // hôte equipCard, guest statsCard
    const groupMoved = cardLayoutReorder(grouped, 'equipCard', -1);
    assert('cardLayoutReorder() déplace le groupe entier (via son hostId)', groupMoved.order.indexOf('equipCard') < grouped.order.indexOf('equipCard'));
    assert('cardLayoutReorder() sur un hostId ne touche pas ses guests (restent hors order)', !groupMoved.order.includes('statsCard') && groupMoved.groups.equipCard.includes('statsCard'));
  }

  // carte Admin (2026-07-13, demande explicite : "créer une nouvelle carte admin ou mettre toute
  // les commandes admin") -- garde-fou statique : masquée via CLASSE (jamais inline style), sinon
  // card-layout.js (cardLayoutResetToStandalone, réinitialise style="" à chaque rendu) l'écraserait
  // au 1er glisser-déposer/changement d'onglet et l'afficherait à un non-admin.
  function testAdminCardHiddenByClassNotInlineStyle() {
    const el = $('adminCard'); if (!el) return;
    assert('#adminCard n\'a pas d\'inline style="display" en dur (sinon écrasé par card-layout.js)', !el.style.display);
    assert('#adminCard porte la classe .adminOnlyCard (masquage CSS)', el.classList.contains('adminOnlyCard'));
    assert('adminCard fait partie de CARD_LAYOUT_IDS (7e carte, déplaçable pour un admin)', CARD_LAYOUT_IDS.includes('adminCard'));
  }

  function testCardLayoutReorderToInsertsBeforeOrAfterTarget() {
    // glisser-déposer ENTRE deux cartes (2026-07-13, retour utilisateur) -- distinct de
    // cardLayoutNest (dépose SUR une carte, imbrique en onglets) : déplace sourceId juste avant
    // ou après targetId dans order, sans toucher aux groups/active de personne.
    if (typeof cardLayoutReorderTo !== 'function') return;
    const base = cardLayoutDefaultState();
    const before = cardLayoutReorderTo(base, 'optCard', 'statsCard', true);
    assert('cardLayoutReorderTo(before=true) insère juste avant la cible', before.order[0] === 'optCard' && before.order[1] === 'statsCard');
    const after = cardLayoutReorderTo(base, 'statsCard', 'lootCard', false);
    assert('cardLayoutReorderTo(before=false) insère juste après la cible', after.order[1] === 'lootCard' && after.order[2] === 'statsCard');
    assert('cardLayoutReorderTo() ne perd ni ne duplique aucune carte', JSON.stringify(after.order.slice().sort()) === JSON.stringify(CARD_LAYOUT_IDS.slice().sort()));
    const clean = sanitizeCardLayoutState(after);
    assert('cardLayoutReorderTo() produit un état qui reste valide après sanitize', JSON.stringify(clean.order) === JSON.stringify(after.order));
    assert('cardLayoutReorderTo() ignore sourceId === targetId (no-op)', cardLayoutReorderTo(base, 'statsCard', 'statsCard', true) === base);
  }

  function testCardLayoutSetActiveTabIgnoresUnknownTab() {
    if (typeof cardLayoutSetActiveTab !== 'function') return;
    const base = cardLayoutNest(cardLayoutDefaultState(), 'statsCard', 'equipCard');
    const same = cardLayoutSetActiveTab(base, 'equipCard', 'lootCard'); // lootCard n'est pas un onglet de ce groupe
    assert('cardLayoutSetActiveTab() ignore un tabId qui n\'appartient pas au groupe', same.active.equipCard === base.active.equipCard);
    const switched = cardLayoutSetActiveTab(base, 'equipCard', 'equipCard');
    assert('cardLayoutSetActiveTab() accepte de revenir sur l\'onglet hôte', switched.active.equipCard === 'equipCard');
  }

  // ---------- Menu objet inventaire : Jeter/Vendre au marché/protection Compendium (2026-07-24) ----------
  // Bouton "Jeter" du menu objet -- vérifie EN CONDITIONS RÉELLES (showItemMenu + confirm() mocké,
  // pas juste une inspection statique) qu'annuler la confirmation ne modifie PAS INV, et que
  // confirmer détruit bien le slot -- suit le modèle demandé pour toute action irréversible d'objet.
  function testDropConfirmCancelDoesNotModifyInvButConfirmDoes() {
    if (typeof showItemMenu !== 'function' || typeof dropItem !== 'function') return;
    const idx = INV_SIZE - 2;
    const saved = INV[idx];
    const savedConfirm = window.confirm;
    try {
      INV[idx] = { name:'Objet de test jeter', kind:'trash', qty:1, val:5, stackable:true, key:'t_drop_test' };
      showItemMenu(0, 0, { invIndex: idx, ...INV[idx] });
      const dropLabel = i18next.t('inventory:inventory.action_drop');
      let btn = [...$('itemPop').querySelectorAll('button')].find(b => b.textContent === dropLabel);
      assert('showItemMenu affiche bien un bouton "Jeter"', !!btn);
      if (!btn) return;
      window.confirm = () => false;
      btn.click();
      assert('Annuler la confirmation de "Jeter" NE modifie PAS INV', !!INV[idx] && INV[idx].key === 't_drop_test', `INV[idx]=${JSON.stringify(INV[idx])}`);
      // reconstruit le popup pour le 2e essai (le clic précédent a déjà appelé hideItemPop())
      showItemMenu(0, 0, { invIndex: idx, ...INV[idx] });
      btn = [...$('itemPop').querySelectorAll('button')].find(b => b.textContent === dropLabel);
      window.confirm = () => true;
      btn.click();
      assert('Confirmer "Jeter" détruit bien le slot INV', INV[idx] === null, `INV[idx]=${JSON.stringify(INV[idx])}`);
    } finally {
      window.confirm = savedConfirm;
      INV[idx] = saved;
      hideItemPop();
    }
  }
  // "🏛️ Vendre au marché" doit apparaître seulement pour les kinds qui ont une entrée au catalogue
  // Marché (material/gear/jackpot) -- le trash n'a AUCUNE source de vente joueur-à-joueur, seul
  // sell1/sellAll (vente instantanée au vendeur) s'y applique.
  function testSellMarketButtonGatedByKindNotTrash() {
    if (typeof showItemMenu !== 'function') return;
    const idx = INV_SIZE - 3;
    const saved = INV[idx];
    const marketLabel = i18next.t('inventory:inventory.action_sell_market');
    try {
      INV[idx] = { name:'Objet de test trash', kind:'trash', qty:1, val:5, stackable:true, key:'t_trash_test' };
      showItemMenu(0, 0, { invIndex: idx, ...INV[idx] });
      let btn = [...$('itemPop').querySelectorAll('button')].find(b => b.textContent === marketLabel);
      assert('Le trash n\'a PAS de bouton "Vendre au marché" (aucune entrée catalogue Marché pour ce kind)', !btn);

      INV[idx] = { name:'Pierre de Novice', kind:'material', qty:5, stackable:true, val:1, key:'t_mat_test' };
      showItemMenu(0, 0, { invIndex: idx, ...INV[idx] });
      btn = [...$('itemPop').querySelectorAll('button')].find(b => b.textContent === marketLabel);
      assert('Un matériau a bien un bouton "Vendre au marché"', !!btn);
    } finally { INV[idx] = saved; hideItemPop(); }
  }
  // Objet du sac protégé Compendium : jamais de Jeter/Vendre (romprait silencieusement la collection
  // de zone, voir zoneFullyCollected) -- tooltip explicite affiché à la place.
  function testCompendiumItemMenuHasNoDropOrMarketSellButtons() {
    if (typeof showItemMenu !== 'function' || typeof COMPENDIUM_BAG === 'undefined') return;
    const idx = INV_SIZE - 4;
    const saved = COMPENDIUM_BAG[idx];
    try {
      COMPENDIUM_BAG[idx] = { name:'Objet de test compendium', kind:'gear', slot:'helmet', ap:0, dp:5, hp:0, enhLv:0, key:'t_comp_test' };
      showItemMenu(0, 0, { compIndex: idx, ...COMPENDIUM_BAG[idx] });
      const pop = $('itemPop');
      const dropLabel = i18next.t('inventory:inventory.action_drop');
      const marketLabel = i18next.t('inventory:inventory.action_sell_market');
      const buttons = [...pop.querySelectorAll('button')].map(b => b.textContent);
      assert('Un objet du Compendium n\'a jamais de bouton "Jeter"', !buttons.includes(dropLabel));
      assert('Un objet du Compendium n\'a jamais de bouton "Vendre au marché"', !buttons.includes(marketLabel));
      assert('Un objet du Compendium affiche l\'explication de protection', pop.innerHTML.includes(i18next.t('inventory:inventory.compendium_protected_hint')));
    } finally { COMPENDIUM_BAG[idx] = saved; hideItemPop(); }
  }
  // openMarketSellFor (market.js) doit présélectionner l'objet EXACT (même niveau d'enchant), jamais
  // juste le meilleur prix tous niveaux confondus -- vérifié via cmGroupForExactItem sur un jeu de
  // listings fictif avec 2 niveaux différents du même objet.
  function testCmGroupForExactItemMatchesOnlyTheRequestedEnhLv() {
    if (typeof cmGroupForExactItem !== 'function') return;
    const savedListings = cmListings;
    try {
      cmListings = [
        { item_name:'Bâton Naru', item_kind:'gear', price:1000, item_snapshot:{ enhLv:5 } },
        { item_name:'Bâton Naru', item_kind:'gear', price:500,  item_snapshot:{ enhLv:12 } },
        { item_name:'Bâton Naru', item_kind:'gear', price:800,  item_snapshot:{ enhLv:12 } },
      ];
      const g = cmGroupForExactItem('Bâton Naru', 'gear', 12);
      assert('cmGroupForExactItem cible le bon niveau d\'enchant (12), pas le meilleur prix tous niveaux confondus', g.best && g.best.price === 500, `best=${JSON.stringify(g.best)}`);
      const gAbsent = cmGroupForExactItem('Bâton Naru', 'gear', 7);
      assert('cmGroupForExactItem renvoie best=null si aucune vente au niveau demandé', gAbsent.best === null);
    } finally { cmListings = savedListings; }
  }
  // Garde-fou statique : le bouton "Vendre au marché" du menu objet appelle bien openMarketSellFor
  // (pas un doublon de sellOne/sellStack) -- confirme que l'action instantanée existante n'a pas été
  // remplacée par erreur, seulement complétée.
  function testSellMarketButtonCallsOpenMarketSellFor() {
    if (typeof showItemMenu !== 'function') return;
    const src = showItemMenu.toString();
    assert('showItemMenu() appelle openMarketSellFor(s) pour le bouton "Vendre au marché"', src.includes('openMarketSellFor(s)'));
    assert('showItemMenu() garde sell1/sellAll (vente instantanée) intacts en plus du marché', src.includes('sellOne(data.invIndex)') && src.includes('sellStack(data.invIndex)'));
  }

  // ---------- Mini Boss (2026-07-13, combat/miniboss-data.js/miniboss.js) ----------
  function testMinibossRecipeAndDropRates() {
    assert('MINIBOSS_PARCHEMIN_RECIPE.needQty === 5', MINIBOSS_PARCHEMIN_RECIPE.needQty === 5, `needQty=${MINIBOSS_PARCHEMIN_RECIPE.needQty}`);
    assert('MINIBOSS_FORBIDDEN_BOOK.ch === 0.008 (0,80%)', MINIBOSS_FORBIDDEN_BOOK.ch === 0.008, `ch=${MINIBOSS_FORBIDDEN_BOOK.ch}`);
    assert('MINIBOSS_FORBIDDEN_BOOK.kind === material (vendable au marché, voir MARKET_MATERIALS)', MINIBOSS_FORBIDDEN_BOOK.kind === 'material');
    assert('MINIBOSS_PARCHEMIN.kind === craft (jamais listé dans MARKET_MATERIALS, donc non vendable)', MINIBOSS_PARCHEMIN.kind === 'craft');
  }
  // garde-fou statique (même esprit que les autres inspections .toString() de ce fichier) : le
  // Livre interdit doit tomber dans TOUTES les zones, indépendamment de zoneIdx -- on vérifie que
  // rollDrops() référence bien MINIBOSS_FORBIDDEN_BOOK dans son tableau `table` (construit à
  // chaque appel, pas conditionné par la zone), même mécanisme que Pierre de Cron (CRON_STONE).
  function testForbiddenBookDropsInEveryZone() {
    const src = rollDrops.toString();
    assert('rollDrops() référence MINIBOSS_FORBIDDEN_BOOK dans sa table de drop (universel, comme CRON_STONE)', src.includes('MINIBOSS_FORBIDDEN_BOOK'));
    assert('rollDrops() référence aussi CRON_STONE (même mécanisme de drop universel, non zoné)', src.includes('CRON_STONE'));
  }
  // MARKET_MATERIALS (src/market/market.js) est la liste blanche qui rend un matériau vendable
  // (marketCatalog() ne construit une entrée QUE depuis cette liste) -- vérifie explicitement que
  // Livre interdit y figure et que le nom du Parchemin n'y figure jamais.
  function testForbiddenBookSellableParcheminIsNot() {
    const names = MARKET_MATERIALS.map(m => m.name);
    assert('MARKET_MATERIALS contient "Livre interdit" (vendable au marché)', names.includes(MINIBOSS_FORBIDDEN_BOOK.name));
    assert('MARKET_MATERIALS NE contient PAS "Parchemin de Mini Boss" (jamais échangeable)', !names.includes(MINIBOSS_PARCHEMIN.name));
  }
  function testMinibossGroupBonusTableExact() {
    // table EXACTE fournie par l'utilisateur (voir plan) -- pas une formule linéaire
    const expected = { 1:1, 2:1.1, 3:1.2, 4:1.5, 5:2 };
    Object.entries(expected).forEach(([n, mult]) => {
      assert(`minibossGroupBonusMult(${n}) === ×${mult}`, minibossGroupBonusMult(+n) === mult, `got=${minibossGroupBonusMult(+n)}`);
    });
    assert('minibossGroupBonusMult plafonne à 5 joueurs (6 -> même bonus que 5)', minibossGroupBonusMult(6) === minibossGroupBonusMult(5));
  }
  function testMinibossFinalMultRoleAndGroupSize() {
    // invocateur ×2.0, participant ×0.8 (retour de revue de maquette), multiplié par le bonus de
    // groupe EXACT -- vérifié pour les 2 rôles × 5 tailles de groupe (matrice complète, pas un seul point).
    for (let n = 1; n <= 5; n++) {
      const bonus = minibossGroupBonusMult(n);
      assert(`minibossFinalMult(true, ${n}) = 2.0 × bonus`, Math.abs(minibossFinalMult(true, n) - 2.0*bonus) < 1e-9);
      assert(`minibossFinalMult(false, ${n}) = 0.8 × bonus`, Math.abs(minibossFinalMult(false, n) - 0.8*bonus) < 1e-9);
    }
    assert("L'invocateur reçoit toujours plus qu'un participant à taille de groupe égale", minibossFinalMult(true, 3) > minibossFinalMult(false, 3));
  }
  function testMinibossMaxHpTableByGroupSize() {
    const expected = [0, 100000, 160000, 220000, 280000, 340000];
    for (let n = 1; n <= 5; n++) {
      assert(`minibossMaxHp(${n}) === ${expected[n]}`, minibossMaxHp(n) === expected[n], `got=${minibossMaxHp(n)}`);
    }
    assert('minibossMaxHp croît avec la taille du groupe (jamais moins de PV à plus de joueurs)', minibossMaxHp(5) > minibossMaxHp(1));
    assert('minibossMaxHp plafonne à 5 joueurs', minibossMaxHp(9) === minibossMaxHp(5));
  }
  function testMinibossGearPctClampedAndMonotonic() {
    assert('minibossGearPct(0) === 0', minibossGearPct(0) === 0);
    assert('minibossGearPct négatif clampé à 0', minibossGearPct(-50) === 0);
    const ref = minibossGearRefAp();
    assert('minibossGearPct(refAp) === 100', minibossGearPct(ref) === 100, `got=${minibossGearPct(ref)}`);
    assert('minibossGearPct au-delà du plafond reste clampé à 100', minibossGearPct(ref*3) === 100);
    assert('minibossGearPct croît avec l\'AP', minibossGearPct(ref*0.75) > minibossGearPct(ref*0.25));
  }
  // plafond MAX du run = stock du membre le plus PAUVRE, jamais le mieux fourni (retour explicite
  // de l'utilisateur : "un bouton MAX toujours selon le joueur qui en a le moins")
  function testMinibossMaxRunLengthCappedByPoorestMember() {
    assert('minibossMaxRunLength([14,2,6]) === 2 (le plus pauvre, pas le plus riche)', minibossMaxRunLength([14,2,6]) === 2);
    assert('minibossMaxRunLength([]) === 0 (aucun membre)', minibossMaxRunLength([]) === 0);
    assert('minibossMaxRunLength([5,5,5]) === 5 (stocks égaux)', minibossMaxRunLength([5,5,5]) === 5);
  }
  function testMinibossReputationScoreFormula() {
    assert('minibossReputationScore(0,0) === 5 (aucun run joué, pas de mauvaise note par défaut)', minibossReputationScore(0,0) === 5);
    assert('minibossReputationScore(39,3) === 4.6 (arrondi à 1 décimale)', minibossReputationScore(39,3) === 4.6, `got=${minibossReputationScore(39,3)}`);
    assert('minibossReputationScore(1,4) === 1.0 (majorité d\'incidents -> note basse)', minibossReputationScore(1,4) === 1.0, `got=${minibossReputationScore(1,4)}`);
    assert('minibossReputationScore(10,0) === 5 (aucun incident)', minibossReputationScore(10,0) === 5);
  }
  // garde-fou anti-régression du bug corrigé le 2026-07-14 : sb.rpc() renvoie un thenable Supabase
  // (PostgrestBuilder) qui a .then mais PAS .catch -- `sb.rpc(...).catch(...)` lançait un TypeError
  // et faisait planter startMiniBossFight/endMiniBossFight (l'écran de victoire ne s'affichait
  // jamais, le run ne s'enchaînait pas). Le correctif enveloppe l'appel dans Promise.resolve().
  // Ce test inspecte le .toString() des 2 fonctions (même esprit que les autres tests d'inspection
  // statique du projet) : si un appel sb.rpc(...).catch existe, il DOIT être précédé de Promise.resolve.
  function testMinibossRpcCallsWrappedInPromiseResolve() {
    [['startMiniBossFight', startMiniBossFight], ['endMiniBossFight', endMiniBossFight]].forEach(([name, fn]) => {
      const src = fn.toString();
      const hasRpcCatch = /sb\.rpc\([^)]*\)\)?\.catch/.test(src);
      const hasPromiseResolve = /Promise\.resolve\(\s*sb\.rpc/.test(src);
      if (hasRpcCatch) {
        assert(`${name}: tout sb.rpc(...).catch est enveloppé dans Promise.resolve() (thenable Supabase sans .catch)`, hasPromiseResolve, 'sb.rpc(...).catch sans Promise.resolve() -> TypeError en prod');
      } else {
        assert(`${name}: aucun sb.rpc(...).catch nu (ou migré vers Promise.resolve/await)`, true);
      }
    });
  }
  // câblage de l'onglet header (voir plan §5) -- ACTIVITY_TABS contient bien l'entrée, et
  // showActivityPage('miniboss') ne lève pas et met à jour currentActivity (miroir du test déjà
  // existant pour Compagnon, testCompanionTabShowsNewBadgeInsteadOfLock, même esprit).
  function testMinibossActivityTabWiredCorrectly() {
    const tab = ACTIVITY_TABS.find(t => t.id === 'miniboss');
    assert("ACTIVITY_TABS contient l'entrée 'miniboss'", !!tab);
    if (!tab) return;
    assert("l'onglet Mini Boss n'est pas verrouillé", tab.locked === false);
    const savedActivity = currentActivity;
    let threw = false;
    try { showActivityPage('miniboss'); } catch (e) { threw = true; }
    assert("showActivityPage('miniboss') ne lève aucune exception", !threw);
    assert("showActivityPage('miniboss') met à jour currentActivity à 'miniboss'", currentActivity === 'miniboss', `currentActivity=${currentActivity}`);
    // referme proprement et restaure l'état pour ne pas polluer les tests suivants
    if (minibossState.active) { minibossState.active = false; cancelAnimationFrame(minibossState.raf); }
    const mbr = document.getElementById('minibossRoom'); if (mbr) mbr.classList.remove('open');
    showActivityPage('zone');
    currentActivity = savedActivity;
  }
  // craftMiniBossParchemin() : mêmes garde-fous qu'un test de craft classique -- insuffisant sans
  // ingrédients, réussi une fois les 5 Livres interdits réunis dans une case libre dédiée (voir
  // CLAUDE.md §11 "piège corrigé le 2026-07-19" -- ne jamais supposer une case libre sur le compte
  // de test, réserver/restaurer un slot dédié).
  function testCraftMiniBossParcheminNeedsFiveBooks() {
    const slot = INV_SIZE - 3; // slot dédié, distinct de celui déjà réservé par d'autres tests (INV_SIZE-2)
    const savedSlot = INV[slot];
    const savedParchSlot = invSlotByKey(MINIBOSS_PARCHEMIN.key);
    const savedParch = savedParchSlot !== -1 ? { ...INV[savedParchSlot] } : null;
    try {
      INV[slot] = null;
      assert('craftMiniBossParchemin() échoue sans les 5 Livres interdits', craftMiniBossParchemin() === false);
      INV[slot] = { name:MINIBOSS_FORBIDDEN_BOOK.name, kind:MINIBOSS_FORBIDDEN_BOOK.kind, icon:MINIBOSS_FORBIDDEN_BOOK.icon, color:MINIBOSS_FORBIDDEN_BOOK.color, key:MINIBOSS_FORBIDDEN_BOOK.key, qty:5, stackable:true, weight:0.1, val:0 };
      const before = minibossParcheminQty();
      const ok = craftMiniBossParchemin();
      assert('craftMiniBossParchemin() réussit avec 5 Livres interdits en sac', ok === true);
      assert('craftMiniBossParchemin() consomme les 5 Livres interdits', (INV[slot] === null || INV[slot].qty === 0) || invQtyByKey(MINIBOSS_FORBIDDEN_BOOK.key) === 0);
      assert('craftMiniBossParchemin() donne bien +1 Parchemin de Mini Boss', minibossParcheminQty() === before + 1, `before=${before} after=${minibossParcheminQty()}`);
    } finally {
      INV[slot] = savedSlot;
      if (savedParchSlot !== -1) INV[savedParchSlot] = savedParch; // restaure l'ancien stock exact
      else { const i = invSlotByKey(MINIBOSS_PARCHEMIN.key); if (i !== -1) INV[i] = null; } // pas de Parchemin avant le test -> on retire celui créé
    }
  }

  // ---------- Panneau Historique de silver (V451, clic sur la pastille #shRate) ----------
  // pushSilverMinuteSample : fonction pure (game-core.js) -- cumul dans le bucket minute courant,
  // nouveau bucket à la minute suivante, purge au-delà de SILVER_HIST_WINDOW_MS.
  function testPushSilverMinuteSampleBucketsAndPrunes() {
    const hist = [];
    const base = Math.floor(Date.now() / 60000) * 60000;
    pushSilverMinuteSample(hist, 100, base + 1000);
    pushSilverMinuteSample(hist, 50, base + 30000); // même minute -> cumul
    assert('pushSilverMinuteSample cumule dans le bucket minute courant', hist.length === 1 && hist[0].silver === 150, JSON.stringify(hist));
    pushSilverMinuteSample(hist, 25, base + 61000); // minute suivante -> nouveau bucket
    assert('pushSilverMinuteSample ouvre un nouveau bucket à la minute suivante', hist.length === 2 && hist[1].silver === 25, JSON.stringify(hist));
    // un ajout bien plus tard purge tous les buckets sortis de la fenêtre de 60 min
    pushSilverMinuteSample(hist, 10, base + SILVER_HIST_WINDOW_MS + 61000);
    assert('pushSilverMinuteSample purge les buckets plus vieux que la fenêtre', hist.length === 1 && hist[0].silver === 10, JSON.stringify(hist));
  }
  // buildSilverMinutePoints/buildSilverHourPoints : séries CONTIGUËS (les trous de farm doivent
  // se VOIR comme des 0, jamais se compresser), lignes RPC malformées ignorées sans exception.
  function testBuildSilverPointsFillGapsWithZeros() {
    const now = Date.now();
    const nowMin = Math.floor(now / 60000) * 60000;
    const pts = buildSilverMinutePoints([{ t: nowMin, silver: 300 }, { t: nowMin - 5 * 60000, silver: 120 }], now);
    assert('buildSilverMinutePoints retourne exactement 60 points', pts.length === SILVER_HIST_SESSION_MINUTES, `len=${pts.length}`);
    assert('buildSilverMinutePoints place la minute courante en dernier', pts[pts.length - 1].value === 300, JSON.stringify(pts.slice(-2)));
    assert('buildSilverMinutePoints comble les trous avec des 0', pts.reduce((a, p) => a + p.value, 0) === 420 && pts[pts.length - 6].value === 120, `sum=${pts.reduce((a, p) => a + p.value, 0)}`);
    const nowHour = Math.floor(now / 3600000) * 3600000;
    const hp = buildSilverHourPoints([{ bucket: new Date(nowHour).toISOString(), gained: '500', spent: '20' }, { bucket: 'garbage', gained: 99 }], now);
    assert('buildSilverHourPoints retourne exactement 24 points', hp.length === SILVER_HIST_DAY_HOURS, `len=${hp.length}`);
    assert('buildSilverHourPoints ignore les lignes malformées et ne garde que gained', hp[hp.length - 1].value === 500 && hp.reduce((a, p) => a + p.value, 0) === 500, JSON.stringify(hp.slice(-2)));
  }
  // addSilver ne doit alimenter silverMinuteHistory QUE pour la catégorie 'loot' (même règle que
  // silverRateBuffer/tokenSilverEarned : le revenu de trash, pas les gains ponctuels quête/boss).
  function testAddSilverFeedsMinuteHistoryOnlyForLoot() {
    const savedSilver = S.silver, savedEarned = S.silverEarned, savedToken = S.tokenSilverEarned;
    const savedHist = silverMinuteHistory.map(b => ({ ...b }));
    const savedRate = silverRateBuffer.map(s => ({ ...s }));
    try {
      const sumBefore = silverMinuteHistory.reduce((a, b) => a + b.silver, 0);
      addSilver(7, 'quest', 'test hist');
      assert("addSilver catégorie 'quest' n'alimente PAS silverMinuteHistory", silverMinuteHistory.reduce((a, b) => a + b.silver, 0) === sumBefore);
      addSilver(7, 'loot', 'test hist');
      assert("addSilver catégorie 'loot' alimente silverMinuteHistory", silverMinuteHistory.reduce((a, b) => a + b.silver, 0) === sumBefore + 7);
    } finally {
      S.silver = savedSilver; S.silverEarned = savedEarned; S.tokenSilverEarned = savedToken;
      silverMinuteHistory.length = 0; savedHist.forEach(b => silverMinuteHistory.push(b));
      silverRateBuffer.length = 0; savedRate.forEach(s => silverRateBuffer.push(s));
    }
  }
  // ouverture/fermeture du panneau en mode HORS LIGNE (politique CLAUDE.md §11 : tout ce qui touche
  // au réseau doit dégrader proprement) -- la branche hors ligne de loadSilverHistDayChart est
  // synchrone (avant le moindre await), le message doit donc être déjà dans le DOM après le toggle.
  function testSilverHistPanelOpensOfflineAndCloses() {
    const savedOffline = isOffline;
    try {
      isOffline = true; // force le chemin hors ligne : la RPC ne doit jamais partir
      const pill = document.getElementById('shRate');
      assert('la pastille #shRate est câblée (classe clickable posée au chargement)', pill && pill.classList.contains('clickable'));
      toggleSilverHistPanel();
      const panel = document.getElementById('silverHistPanel');
      assert("toggle : le panneau Historique de silver s'ouvre", !!panel);
      assert('hors ligne : le graphique 24 h est remplacé par le message dédié, sans exception',
        panel && panel.innerHTML.includes(i18next.t('backend:backend.silver_hist.offline')));
      toggleSilverHistPanel();
      assert('re-toggle : le panneau se referme', !document.getElementById('silverHistPanel'));
    } finally {
      isOffline = savedOffline;
      const leftover = document.getElementById('silverHistPanel'); if (leftover) leftover.remove();
    }
  }

  // ---------- Rattrapage arrière-plan + déblocage des records (2026-07-15, "bloqué à 500 silver/min") ----------
  // advanceSim doit rattraper le temps réel écoulé en SOUS-PAS de 2s max (le throttling "intensive"
  // de Chrome limite le setInterval de secours à 1 réveil/min onglet caché : l'ancien clamp unique
  // à 2s jetait 58s sur 60 -> farm à 1/30 du rythme). Stubs sur les ticks internes pour compter les
  // sous-pas sans dérouler la vraie simulation ; `last` (baseline module de advanceSim) est
  // accessible/restaurable depuis ce script (même scope global partagé, cf. le test sessionLocked).
  function testAdvanceSimCatchesUpHiddenTimeInSubSteps() {
    if (typeof advanceSim !== 'function' || typeof simTickOnce !== 'function') return;
    const savedFsm = fsm, savedWolves = wolvesTick, savedDrops = dropsTick, savedParticles = particlesTick, savedSpawn = spawnPackNear, savedLast = last;
    let calls = 0, totalDt = 0, maxStep = 0;
    const savedReady = saveReady;
    try {
      // saveReady forcé à true : ce test porte sur le DÉCOUPAGE en sous-pas du rattrapage, pas sur
      // la garde "aucune simulation tant que la sauvegarde n'est pas connue" (advanceSim,
      // 2026-07-22), qui sortirait avant et laisserait totalDt=0.
      saveReady = true;
      fsm = dt => { calls++; totalDt += dt; maxStep = Math.max(maxStep, dt); };
      wolvesTick = () => {}; dropsTick = () => {}; particlesTick = () => {}; spawnPackNear = () => {};
      const t0 = performance.now();
      advanceSim(t0); // synchronise la baseline `last`
      calls = 0; totalDt = 0; maxStep = 0;
      advanceSim(t0 + 60000); // simule le réveil du setInterval après 60s d'onglet caché (throttling Chrome)
      assert('advanceSim rattrape la totalité des ~60s cachées (plus jamais 2s sur 60)', Math.abs(totalDt - 60) < 0.01, `totalDt=${totalDt}`);
      assert('advanceSim découpe le rattrapage en sous-pas de 2s max (physique/FSM préservées)', maxStep <= 2 && calls === 30, `calls=${calls} maxStep=${maxStep}`);
      calls = 0; totalDt = 0;
      advanceSim(t0 + 60000 + 16); // frame rAF normale onglet visible : un seul sous-pas, comme avant
      assert('advanceSim onglet visible : un seul sous-pas par frame, comportement inchangé', calls === 1 && totalDt < 0.5, `calls=${calls} totalDt=${totalDt}`);
      calls = 0; totalDt = 0;
      advanceSim(t0 + 60016 + 7200000); // mise en veille OS de 2h : borné à BG_CATCHUP_MAX_SEC, jamais un gel de l'onglet
      assert('advanceSim borne un trou géant (veille OS) à BG_CATCHUP_MAX_SEC', Math.abs(totalDt - BG_CATCHUP_MAX_SEC) < 0.01, `totalDt=${totalDt}`);
    } finally {
      fsm = savedFsm; wolvesTick = savedWolves; dropsTick = savedDrops; particlesTick = savedParticles; spawnPackNear = savedSpawn; last = savedLast; saveReady = savedReady;
    }
  }
  // Déblocage des records (silver/h, kpm, xp/h) : un rythme SOUTENU bien au-delà de +30% du record
  // (des dizaines de petits gains répartis sur toute la fenêtre -- le profil réel du farm de trash)
  // doit désormais devenir éligible (taux recalculé sans le plus gros échantillon), là où l'ancien
  // rejet pur figeait le record pour toujours (constaté en prod : record 6 800/h, farm réel ~50×).
  // Le pic ISOLÉ reste rejeté -- déjà couvert par testComputeSliding*IgnoresIsolatedSpikeForRecord.
  function testComputeSlidingRatesUnfreezeRecordOnSustainedHigherRate() {
    if (typeof computeSlidingSilverPerHour !== 'function') return;
    const now = Date.now();
    // silver : record figé à 6 800/h, farm réel ~900 000/h réparti en 60 petits gains sur 3 min
    const silverBest = 6800, silverReal = 900000;
    const silverBuf = [];
    for (let i = 0; i < 60; i++) silverBuf.push({ t: now - SILVER_RATE_WINDOW_MS + 1000 + i * ((SILVER_RATE_WINDOW_MS - 2000) / 59), silver: silverReal * (SILVER_RATE_WINDOW_MS / 3600000) / 60 });
    const sv = computeSlidingSilverPerHour(silverBuf, now, silverBest);
    assert('silver/h : un rythme soutenu ~130× le record devient éligible (record débloqué)', sv.eligible === true, JSON.stringify(sv));
    assert('silver/h : le taux candidat reste proche du vrai rythme (à peine rogné du plus gros échantillon)', sv.ratePerHour > silverReal * 0.9, `rate=${sv.ratePerHour}`);
    // kpm : même profil (1 échantillon par kill)
    const kpmBuf = [];
    for (let i = 0; i < 90; i++) kpmBuf.push({ t: now - KPM_RATE_WINDOW_MS + 1000 + i * ((KPM_RATE_WINDOW_MS - 2000) / 89), kills: 1 });
    const kv = computeSlidingKpm(kpmBuf, now, 10); // ~30 kills/min réels contre un record de 10
    assert('kpm : un rythme soutenu à 3× le record devient éligible (record débloqué)', kv.eligible === true && kv.ratePerMin > 25, JSON.stringify(kv));
    // xp/h : même profil que silver
    const xpBuf = [];
    for (let i = 0; i < 60; i++) xpBuf.push({ t: now - XP_RATE_WINDOW_MS + 1000 + i * ((XP_RATE_WINDOW_MS - 2000) / 59), xp: 100 });
    const xv = computeSlidingXpPerHour(xpBuf, now, 1000);
    assert('xp/h : un rythme soutenu bien au-delà de +30% devient éligible (record débloqué)', xv.eligible === true, JSON.stringify(xv));
  }

  // ---------- Survol des graphiques + courbe de solde (V453) ----------
  // chartIndexFromX/buildSilverBalancePoints/buildLineSeriesSvg : fonctions pures du panneau
  // Historique de silver (backend/silver-history-panel.js).
  function testSilverBalanceAndHoverHelpers() {
    if (typeof chartIndexFromX !== 'function') return;
    // bornes : jamais hors [0, n-1], même avec une souris hors du tracé
    assert('chartIndexFromX borne à gauche', chartIndexFromX(-50, 60, false) === 0);
    assert('chartIndexFromX borne à droite', chartIndexFromX(500, 60, false) === 59);
    // barres : slot plein (floor) ; ligne : point le plus proche (round)
    assert('chartIndexFromX barres : slot plein', chartIndexFromX(5 + (390 / 60) * 10 + 1, 60, false) === 10);
    assert('chartIndexFromX ligne : point le plus proche', chartIndexFromX(5 + (390 / 23) * 11, 24, true) === 11);
    // reconstruction du solde à REBOURS depuis le solde actuel
    const now = Date.now();
    const nowHour = Math.floor(now / 3600000) * 3600000;
    const rows = [
      { bucket: new Date(nowHour).toISOString(), gained: 100, spent: 40 },        // net +60 (heure courante)
      { bucket: new Date(nowHour - 3600000).toISOString(), gained: 10, spent: 0 }, // net +10 (heure précédente)
      { bucket: 'garbage', gained: 999 },                                          // ignorée sans exception
    ];
    const pts = buildSilverBalancePoints(rows, now, 1000);
    assert('buildSilverBalancePoints retourne 24 points, solde actuel en dernier', pts.length === 24 && pts[23].value === 1000, JSON.stringify(pts.slice(-1)));
    assert('buildSilverBalancePoints déroule le solde à rebours (net de chaque heure retiré)', pts[22].value === 940 && pts[21].value === 930 && pts[0].value === 930, `h-1=${pts[22].value} h-2=${pts[21].value}`);
    // courbe : vide/1 point -> juste l'axe, jamais d'exception ; série normale -> polyline présente
    assert('buildLineSeriesSvg tableau vide : juste l\'axe, pas d\'exception', typeof buildLineSeriesSvg([], '#fff') === 'string' && !buildLineSeriesSvg([], '#fff').includes('polyline'));
    assert('buildLineSeriesSvg série normale : courbe présente', buildLineSeriesSvg(pts, '#fff').includes('polyline'));
  }
  // survol réel : mousemove sur le graphe de session (panneau ouvert hors ligne) -> tooltip
  // visible avec "label · valeur". Restaure buffers/état comme testAddSilverFeedsMinuteHistoryOnlyForLoot.
  function testSilverHistChartTooltipShowsOnHover() {
    if (typeof toggleSilverHistPanel !== 'function') return;
    const savedOffline = isOffline;
    const savedHist = silverMinuteHistory.map(b => ({ ...b }));
    try {
      isOffline = true;
      pushSilverMinuteSample(silverMinuteHistory, 500, Date.now()); // garantit un graphe de session non vide
      toggleSilverHistPanel();
      const cont = document.getElementById('shpSessionChart');
      const svg = cont && cont.querySelector('svg');
      assert('le graphe de session est présent avec des données', !!svg);
      if (svg) {
        const r = svg.getBoundingClientRect();
        svg.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + r.width - 2, clientY: r.top + 10, bubbles: true }));
        const tip = cont.querySelector('.shpTip');
        assert('mousemove sur le graphe : tooltip visible', tip && tip.style.display === 'block');
        // pas de valeur exacte : le jeu farme en live pendant les tests, la minute courante peut
        // déjà contenir d'autres gains en plus des 500 injectés -- on vérifie le FORMAT du tooltip
        assert('le tooltip affiche "label · valeur silver"', tip && /^\d{2}:\d{2} · .+ silver$/.test(tip.textContent), tip && tip.textContent);
        svg.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        assert('mouseleave : tooltip masqué', tip && tip.style.display === 'none');
      }
      // la pastille silver (💰) ouvre le même panneau que silver/min
      assert('la pastille #silverPill est câblée elle aussi', document.getElementById('silverPill').classList.contains('clickable'));
      toggleSilverHistPanel();
    } finally {
      isOffline = savedOffline;
      silverMinuteHistory.length = 0; savedHist.forEach(b => silverMinuteHistory.push(b));
      const leftover = document.getElementById('silverHistPanel'); if (leftover) leftover.remove();
    }
  }

  // ---------- Classement silver/h + kpm côté serveur (V454) ----------
  // même pattern que testSilverPerHourResetV436ZeroesStaleRecord : les records locaux (pics 3 min
  // extrapolés) sont remis à 0 -- ils ne servent plus qu'au HUD et au taux du rattrapage
  // hors-ligne, le classement est désormais calculé serveur (compute_player_hour_rates).
  function testRateRecordsResetV454ZeroesLocalRecords() {
    if (typeof migrateRateRecordsResetV454 !== 'function') return;
    const beforeSh = S.bestSilverPerHour, beforeKpm = S.bestKpm;
    S.bestSilverPerHour = 2052326; S.bestKpm = 337; // vraies valeurs gonflées constatées en prod
    migrateRateRecordsResetV454();
    assert('Reset V454 : bestSilverPerHour ET bestKpm remis à 0', S.bestSilverPerHour === 0 && S.bestKpm === 0, `sh=${S.bestSilverPerHour} kpm=${S.bestKpm}`);
    S.bestSilverPerHour = beforeSh; S.bestKpm = beforeKpm;
  }
  // syncPlayerStats ne doit PLUS pousser silver_per_hour/best_kpm (colonnes serveur, un trigger
  // les ignore de toute façon -- mais le client ne doit même plus essayer). Garde-fou statique,
  // même famille que testSaveToCloudGuardsSessionLockAndOffline.
  function testSyncPlayerStatsNoLongerPushesServerOwnedRateColumns() {
    if (typeof syncPlayerStats !== 'function') return;
    const src = syncPlayerStats.toString();
    assert('syncPlayerStats ne pousse plus silver_per_hour (colonne serveur V454)', !/silver_per_hour\s*:/.test(src));
    assert('syncPlayerStats ne pousse plus best_kpm (colonne serveur V454)', !/best_kpm\s*:/.test(src));
  }
  // catégories sh/kpm du classement : classées par la colonne "7 derniers jours" (vivante) et
  // affichant AUSSI le record à vie ("les deux colonnes", choix explicite).
  function testLb2RateCatsRankByWeekAndShowBothValues() {
    if (typeof LB2_CATS_ !== 'function') return;
    const cats = LB2_CATS_();
    const row = { silver_per_hour_week: 970992, silver_per_hour: 1200000, best_kpm_week: 153.9, best_kpm: 200 };
    assert('cat sh : classée par silver_per_hour_week (pas le record à vie)', cats.sh.val(row) === 970992, `val=${cats.sh.val(row)}`);
    const shTxt = cats.sh.fmt(row);
    assert('cat sh : affiche la meilleure heure (7 j) ET le record à vie', shTxt.includes(fmt(970992)) && shTxt.includes(fmt(1200000)), shTxt);
    assert('cat kpm : classée par best_kpm_week', cats.kpm.val(row) === 153.9, `val=${cats.kpm.val(row)}`);
    const kpmTxt = cats.kpm.fmt(row);
    assert('cat kpm : affiche la meilleure heure (7 j) ET le record à vie', kpmTxt.includes('153.9') && kpmTxt.includes('200.0'), kpmTxt);
    // lignes sans les nouvelles colonnes (vieux cache) : jamais d'exception, valeur 0
    assert('cat sh/kpm : ligne sans colonnes _week -> 0, pas d\'exception', cats.sh.val({}) === 0 && cats.kpm.val({}) === 0);
  }

  // ---------- Rattrapage hors-ligne au taux serveur (V455) ----------
  // computeOfflineCatchupSilver/Loot doivent préférer data.serverRates (player_stats, colonnes
  // "meilleure heure pleine" possédées par le serveur, attachées par loadCloudSave) au record
  // local S.bestSilverPerHour/bestKpm -- PRÉSENT (même à 0) le taux serveur fait foi ; ABSENT
  // (lecture réseau échouée), repli sur le record local (comportement historique, couvert par
  // testComputeOfflineCatchupSilverCapsAndThresholds qui ne passe jamais de serverRates).
  function testOfflineCatchupPrefersServerRatesOverLocalRecord() {
    if (typeof computeOfflineCatchupSilver !== 'function') return;
    const twoHoursAgo = new Date(Date.now() - 2*3600*1000).toISOString();
    // taux serveur présent : il fait foi, le record local gonflé est ignoré
    const gainServer = computeOfflineCatchupSilver({ savedAt: twoHoursAgo, S:{ bestSilverPerHour: 2052326 }, serverRates:{ silverPerHour: 1000, kpm: 0 } });
    assert('serverRates présent : payé au taux serveur, jamais au record local gonflé', Math.abs(gainServer - 2000) <= 2, `gain=${gainServer}`);
    // taux serveur présent mais à 0 (aucune heure honnête enregistrée) : rien, même avec un record local
    const gainZero = computeOfflineCatchupSilver({ savedAt: twoHoursAgo, S:{ bestSilverPerHour: 2052326 }, serverRates:{ silverPerHour: 0, kpm: 0 } });
    assert('serverRates à 0 : aucun crédit, le record local ne compte plus', gainZero === 0, `gain=${gainZero}`);
    // loot : même bascule sur serverRates.kpm
    if (typeof computeOfflineCatchupLoot === 'function') {
      const lootZero = computeOfflineCatchupLoot({ savedAt: twoHoursAgo, zoneIdx: 9, S:{ bestKpm: 300 }, serverRates:{ silverPerHour: 0, kpm: 0 } });
      assert('loot : serverRates.kpm à 0 -> aucun loot malgré un bestKpm local', Array.isArray(lootZero) && lootZero.length === 0, JSON.stringify(lootZero));
      const lootServer = computeOfflineCatchupLoot({ savedAt: twoHoursAgo, zoneIdx: 9, S:{ bestKpm: 0 }, serverRates:{ silverPerHour: 0, kpm: 60 } });
      assert('loot : serverRates.kpm présent -> loot estimé même sans record local', Array.isArray(lootServer) && lootServer.length > 0, JSON.stringify(lootServer));
    }
    // repli : serverRates absent -> record local (comportement historique)
    const gainFallback = computeOfflineCatchupSilver({ savedAt: twoHoursAgo, S:{ bestSilverPerHour: 3600 } });
    assert('serverRates absent : repli sur le record local', Math.abs(gainFallback - 7200) <= 2, `gain=${gainFallback}`);
  }

  // Familier ramasseur (2026-07-19) : (1) actif dès 1 compagnon possédé, inactif sinon ; (2)
  // collectDrop(l, byPet) ramasse par le MÊME chemin que le perso (silver/taken) et marque
  // l'affichage d'une patte 🐾 ; (3) le ramassage perso (byPet=false) n'a PAS de patte. Voir
  // src/combat/pet-looter.js et collectDrop/lootLine (src/combat/loot-rolls.js).
  function testPetLooterActivationAndTaggedCollect() {
    if (typeof Pet === 'undefined' || typeof collectDrop !== 'function' || typeof refreshPetLooterActivation !== 'function') {
      assert('Familier ramasseur : globals présents', false, 'Pet/collectDrop/refreshPetLooterActivation manquants');
      return;
    }
    const petSaveBefore = localStorage.getItem('velia_idle_pets_save');
    const dropsSnapshot = drops.slice();
    const silver0 = S.silver;

    // (1) activation : un pet de catégorie Collecte (cat.sec==='loot') active le ramasseur et cale
    //     sa vitesse/portée sur ses stats (stats[0]=Vitesse collecte, stats[1]=Rayon).
    localStorage.setItem('velia_idle_pets_save', JSON.stringify({ PETS: [{ rar: 3, cat: { sec: 'loot' }, stats: [20, 10, 0, 0, 0], tierMult: 1.2, terrain: true }] }));
    Pet.checkT = 0; refreshPetLooterActivation(0);
    assert('Familier ramasseur actif avec un pet Collecte', Pet.active === true, `active=${Pet.active}`);
    assert('Vitesse/portée pilotées par les stats Collecte', Pet.speed > 175 && Pet.range > 400, `speed=${Pet.speed} range=${Pet.range}`);
    // un pet NON-Collecte (Combat) ne crée PAS de ramasseur -- ses stats ne sont pas des stats de collecte
    localStorage.setItem('velia_idle_pets_save', JSON.stringify({ PETS: [{ rar: 5, cat: { sec: 'combat' }, stats: [50, 30, 20, 10, 5], tierMult: 1.6 }] }));
    Pet.checkT = 0; refreshPetLooterActivation(0);
    assert('Familier ramasseur inactif sans pet Collecte', Pet.active === false, `active=${Pet.active}`);

    // (2) collectDrop(pet) : trash -> silver + taken, marqué 🐾
    const drop = { x: 0, y: 0, item: { name: 'ZZ_PETLOOT_TRASH', kind: 'trash', color: '#8fbf6f' }, taken: false, silver: 777, age: 0, pop: 0 };
    drops.push(drop);
    const ok = collectDrop(drop, true);
    assert('collectDrop(pet) ramasse le trash au sol', ok === true && drop.taken === true, `ok=${ok} taken=${drop.taken}`);
    assert('collectDrop(pet) crédite le silver (même chemin que le perso)', S.silver === silver0 + 777, `Δ=${S.silver - silver0}`);
    const petTicker = document.getElementById('lootTicker');
    const petLine = petTicker && petTicker.lastElementChild ? petTicker.lastElementChild.innerHTML : '';
    assert('Ligne de loot du familier marquée 🐾', petLine.indexOf('🐾') !== -1, petLine);

    // (3) ramassage perso : PAS de patte
    const dp = { x: 0, y: 0, item: { name: 'ZZ_PETLOOT_PLAYERTRASH', kind: 'trash', color: '#8fbf6f' }, taken: false, silver: 1, age: 0, pop: 0 };
    drops.push(dp);
    collectDrop(dp, false);
    const playerTicker = document.getElementById('lootTicker');
    const playerLine = playerTicker && playerTicker.lastElementChild ? playerTicker.lastElementChild.innerHTML : '';
    assert('Ligne de loot du perso SANS patte', playerLine.indexOf('🐾') === -1, playerLine);

    // (4) bonus de loot du familier : Loot bonus (+% silver) + Chance double (×2), UNIQUEMENT côté pet.
    //     stats[4]=20 -> lootBonus=min(.5,20/100)=0.20 ; stats[2]=50 -> dblChance=min(.6,50/100)=0.50
    localStorage.setItem('velia_idle_pets_save', JSON.stringify({ PETS: [{ rar: 5, cat: { sec: 'loot' }, stats: [30, 20, 50, 0, 20], tierMult: 1.0, terrain: true }] }));
    Pet.checkT = 0; refreshPetLooterActivation(0);
    const origRandom = Math.random;
    try {
      Math.random = () => 0.99; // > dblChance -> pas de double, on isole le loot bonus
      const sB = S.silver;
      const dA = { x: 0, y: 0, item: { name: 'ZZ_BONUS_TRASH', kind: 'trash', color: '#8fbf6f' }, taken: false, silver: 1000, age: 0, pop: 0 };
      drops.push(dA); collectDrop(dA, true);
      assert('Loot bonus du familier : +20% sur le silver trash', S.silver === sB + 1200, `Δ=${S.silver - sB}`);
      Math.random = () => 0.0; // < dblChance -> double
      const sC = S.silver;
      const dB = { x: 0, y: 0, item: { name: 'ZZ_BONUS_TRASH2', kind: 'trash', color: '#8fbf6f' }, taken: false, silver: 1000, age: 0, pop: 0 };
      drops.push(dB); collectDrop(dB, true);
      assert('Chance double du familier : silver trash ×2 (après +20%)', S.silver === sC + 2400, `Δ=${S.silver - sC}`);
      // le perso ne profite JAMAIS des bonus du familier
      Math.random = () => 0.0;
      const sD = S.silver;
      const dP = { x: 0, y: 0, item: { name: 'ZZ_BONUS_PLAYER', kind: 'trash', color: '#8fbf6f' }, taken: false, silver: 1000, age: 0, pop: 0 };
      drops.push(dP); collectDrop(dP, false);
      assert('Le perso ne profite pas des bonus du familier', S.silver === sD + 1000, `Δ=${S.silver - sD}`);
    } finally { Math.random = origRandom; }

    // restauration
    drops.length = 0; dropsSnapshot.forEach(d => drops.push(d));
    if (petSaveBefore === null) localStorage.removeItem('velia_idle_pets_save'); else localStorage.setItem('velia_idle_pets_save', petSaveBefore);
    Pet.checkT = 0; Pet.active = false;
  }

  window.runRegressionTests = function() {
    results.length = 0;
    testSessionLockBoxUsesZoneRedesignTokens();
    testToastsUseZoneRedesignTokens();
    testEquipmentPaperdollUsesZoneRedesignTokens();
    testSkillBarAndPotSelectUseZoneRedesignTokens();
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
    testBubbleSelectorsStyleFAlwaysShowLabelsAndUseZoneTokens();
    testAiFarmModeSlidersPositionedTopRightWithoutOverlap();
    testZtCompendiumHiddenOnlyOnMobile();
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
    testCompendiumSweepRescuesStuckMasteredItemOnEveryLoad();
    testConclaveSealOnlyVeliaFragmentUnlocked();
    testConclaveSealAssembleFailsWithoutAllFiveFragments();
    testConclaveSealAssembleSucceedsWithAllFiveFragmentsSimulated();
    testConclaveSealMarketEffectsGatedByAssembly();
    testConclaveSealRegionalPassiveIsGenericNotHardcodedToVelia();
    testMarketSellTaxRateMatchesServerFactor();
    testMarketPaneIsFlexColumnSoInnerColumnsScrollIndependently();
    testMarketCatalogUsesOnlyRealGameNames();
    testMarketCatalogCoversGearSlotsAndSkipsArtifactDeadCategory();
    testCmItemKeyMatchesServerKeyFormat();
    testFindInvIndexForSellMatchesExactEnhLv();
    testOwnedQtyForMaterialsSumsButGearIsBinaryPerEnhLv();
    testMarketSellRemovesInvLocallyBeforeCloudReload();
    testSellHandlerLocalMutationMatchesServerSemantics();
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
    testDaggerRendersOnlyWhenSecondaryEquipped();
    testDrawWolfIsoNeverThrows();
    testDrawProttyIsoNeverThrows();
    testDrawPirateIsoNeverThrows();
    testDrawRhutumIsoNeverThrows();
    testDrawShultzIsoNeverThrows();
    testDrawSausanIsoNeverThrows();
    testDrawMineurIsoNeverThrows();
    testDrawHelmIsoNeverThrows();
    testDrawGahazIsoNeverThrows();
    testDrawElricIsoNeverThrows();
    testDrawUluanIsoNeverThrows();
    testDrawManesIsoNeverThrows();
    testDrawTrollIsoNeverThrows();
    testDrawBashimIsoNeverThrows();
    testDrawIliyaIsoNeverThrows();
    testDrawPollyTrollIsoNeverThrows();
    testMigratePenMasteryV308MarksExistingPenItems();
    testEvictMasteredFromCompendiumBagOnAnyCopyReachingPen();
    testMigratePenMasteryV308EvictsCompendiumRetroactively();
    testBestGearscoreApDpNeverDecrease();
    testBestSilverPerHourNeverDecreasesAndRequiresTwoMinutes();
    testBestXpPerHourNeverDecreasesAndRequiresTwoMinutes();
    testShRateDisplaysPerMinuteNotPerHour();
    testAdminEquipFullTierSetCoversAllFourTiers();
    testChestZoomToggleWorks();
    testCheckForUpdateFetchesFileThatActuallyCarriesTheVersion();
    testUpdateCountdownStartsAt15sAndIsCleanedUp();
    testErrorMessagesAreEscapedBeforeInnerHtml();
    testShowPlayerGearHasBackToLeaderboardButton();
    testSupabaseScriptIsPinnedWithIntegrity();
    testNoLegacyHardcodedBorderHexOutsideAdminOrDeadCascade();
    testSorcierRenderLoadsBeforeSyncStartupCallers();
    testGameSupabaseSplitKeepsOriginalScriptOrder();
    testCrossFileButtonHandlersAreDeferred();
    testPrefersReducedMotionHelper();
    testReducedMotionBossRevealOnlySkipsAnimationNotOutcome();
    testPatchNotesDatesFormatAndOrder();
    testEveryPatchSubHasALabel();
    testHeaderShortcutButtonsExistWithTitleAndAdminHidden();
    testHeaderShortcutButtonsDelegateToSidebarClick();
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
    testGearRescaleV403RetroactiveOnZoneReqChange();
    testGearLeaderboardRecordFixV405RecomputesEvenDownward();
    testMergeStackableDuplicatesV407MergesSameNamePiles();
    testVeliaChestStorePartialQuantityFromSlider();
    testHudDerivesGearscoreFromBestApDp();
    testGearscoreDerivedFixV414RetroactivelyCorrectsStaleRecord();
    testSilverPerHourResetV436ZeroesStaleRecord();
    testBestKpmResetV439ZeroesStaleRecord();
    testBestXpPerHourResetV440ZeroesStaleRecord();
    testDisplayNamesAllHaveNameEnEntry();
    testLootTickerTranslatesNamesInEnglishMode();
    testMailboxLoyaltyEntryShowsCanonicalNameEvenFromOldSave();
    testGainXpTrackRateFalseNeverFeedsXpRateBuffer();
    testApplySaveStateUpdatesZoneTitleText();
    testComputeOfflineCatchupSilverCapsAndThresholds();
    testComputeOfflineCatchupXpCapsAndThresholds();
    testComputeOfflineElapsedHoursUsesMoreRecentOfSavedAtAndServerCredit();
    testOfflineCreditZoneLootTableMatchesClientZonesData();
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
    testGahazBossGetsExtraHpDmgMultOnTopOfGenericAlpha();
    testPickGahazTeleportSpotStaysWithinConfiguredRingAroundPlayer();
    testGahazBossTeleportMovesPackSpawnsVfxAndResetsCooldown();
    testWolvesTickTriggersGahazTeleportWhenCooldownExpiresOnAggroPack();
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
    testTutorialBoxUsesZoneRedesignTokens();
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
    testApplySaveStateOfflineCatchupCreditsXpAndHandlesLevelUp();
    testComputeOfflineCatchupLootUsesZoneLootTableAndKpm();
    testComputeOfflineCatchupLootReturnsEmptyWithoutKpmOrSavedAt();
    testApplySaveStateOfflineCatchupCreditsLootIntoInv();
    testOfflineCatchupLootSkipsGracefullyWhenBagFull();
    testReconnectHistoryDetailRendersSessionBreakdown();
    testComputeSlidingSilverPerHourStableRateWithinWindow();
    testComputeSlidingSilverPerHourIgnoresIsolatedSpikeForRecord();
    testComputeSlidingSilverPerHourRejectsShortBurstRightAfterConnection();
    testComputeSlidingSilverPerHourAcceptsProgressiveIncreaseAsRecord();
    testComputeSlidingKpmStableRateWithinWindow();
    testComputeSlidingKpmIgnoresIsolatedSpikeForRecord();
    testComputeSlidingKpmRejectsShortBurstRightAfterConnection();
    testComputeSlidingKpmAcceptsProgressiveIncreaseAsRecord();
    testComputeSlidingXpPerHourStableRateWithinWindow();
    testComputeSlidingXpPerHourIgnoresIsolatedSpikeForRecord();
    testComputeSlidingXpPerHourRejectsShortBurstRightAfterConnection();
    testComputeSlidingXpPerHourAcceptsProgressiveIncreaseAsRecord();
    testShowAwayLootSummaryTriggersOnXpOnlyGain();
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
    testComputeBossSharedConfirmStatePendingThenSoloFallback();
    testBossLobbyBlocksThenShowsHonestSoloFallbackWhenSharedUnconfirmed();
    testBossSharedVictoryOnlyFromServerConfirmationNeverLocalPrediction();
    testApplyBossContributeResponseSetsServerConfirmedDeadOnlyWhenHpReachesZero();
    testBossLoopDelegatesSharedVictoryDecisionToPureHelper();
    testRefreshLiveBossLogsAndRetriesOnFailure();
    testGroupAchievementsIntoChainsGroupsByStatFnIdentity();
    testChainProgressNeverMarksIntermediateTierDoneAheadOfChain();
    testSortChainsForDisplayPushesCompletedChainsToEnd();
    testAchievementSilverTotalsSplitsEarnedAndRemaining();
    testAchCatCompletionUsesRealUnlockedCounts();
    testRecentlyUnlockedAchievementsSortsByTimestampDescendingAndRespectsLimit();
    testRecentlyUnlockedAchievementsIgnoresNonNumericTimestamps();
    testLb2CompendiumCategoryUsesRealPct();
    testLb2ComputeYourRankInfoFindsRealRankOutsideTop20();
    testBuildLootDiscordSummaryGroupsByItem();
    testCloseAuthOnlyWithSession();
    testAdvanceSimDoesNothingBeforeSaveReady();
    testLb2GsLadderExcludesStaleBalanceRecords();
    testAuthModesWellFormed();
    testLb2YourRankBarThresholdIsTop20();
    testLb2GuestGateReusesMarketCopyAndRealLinkButton();
    testOpenLeaderboard2ShowsStyledGuestGateNotRawAlert();
    testSidebarAndFloatWidgetsAreReskinnedNotLegacyGeorgia();
    testInfoBoxSharedShellUsesZoneRedesignTokens();
    testPatchImgBoxReusesInfoBoxShell();
    testAuthBoxUsesZoneRedesignTokens();
    testGroupNotifEntriesGroupsInfoAtThresholdButNeverSuccessOrImportant();
    testNotifDayKeyMatchesChatDayGrouping();
    testComputeNotifUnreadCountDerivesFromLastSeenTsNotACounter();
    testEnsureNotifLastSeenMigratesExistingLogToSeenButFreshLogToZero();
    testOpeningNotifCenterKeepsUnreadUntilRealClose();
    testMarkAllNotifReadClearsBadgeButKeepsLogEntries();
    testHandleNotifClearScopesToDisplayedCategoryOnlyWithTwoClickConfirm();
    testNotifActionButtonOnlyRendersForGuestModeIcon();
    testNotifRailShowsPerCategoryUnreadCounts();
    testHandleNotifClearArmedButtonAutoRevertsFieldNotUsedElsewhere();
    testCanvasResolutionNeverChangedByMobileCrop();
    testMapCanvasClickToWorldDesktopUniformScale();
    testMapCanvasClickToWorldMobileCoverCrop();
    testUpdateLoginStreakIncrementsOnConsecutiveDays();
    testUpdateLoginStreakResetsOnGapOfTwoOrMoreDays();
    testUpdateLoginStreakNoOpSameDayReplayed();
    testDeleteAccountConfirmGatedByExactPseudoMatch();
    testDropConfirmCancelDoesNotModifyInvButConfirmDoes();
    testSellMarketButtonGatedByKindNotTrash();
    testCompendiumItemMenuHasNoDropOrMarketSellButtons();
    testCmGroupForExactItemMatchesOnlyTheRequestedEnhLv();
    testSellMarketButtonCallsOpenMarketSellFor();
    testCardLayoutSanitizeAcceptsDefaultState();
    testCardLayoutSanitizeRejectsCorruptState();
    testCardLayoutSanitizeKeepsValidNestedGroup();
    testCardLayoutSanitizeFixesInvalidActiveTab();
    testCardLayoutNestMovesGuestUnderTargetAndSetsItActive();
    testCardLayoutNestFlattensSourceThatWasItselfAHost();
    testCardLayoutDetachRestoresStandaloneCardRightAfterHost();
    testCardLayoutDetachTargetsOneSpecificGuestAmongSeveral();
    testCardLayoutReorderSwapsWithNeighborAndNoopsAtEdges();
    testAdminCardHiddenByClassNotInlineStyle();
    testCardLayoutReorderToInsertsBeforeOrAfterTarget();
    testCardLayoutSetActiveTabIgnoresUnknownTab();
    testMinibossRecipeAndDropRates();
    testForbiddenBookDropsInEveryZone();
    testForbiddenBookSellableParcheminIsNot();
    testMinibossGroupBonusTableExact();
    testMinibossFinalMultRoleAndGroupSize();
    testMinibossMaxHpTableByGroupSize();
    testMinibossGearPctClampedAndMonotonic();
    testMinibossMaxRunLengthCappedByPoorestMember();
    testMinibossReputationScoreFormula();
    testMinibossRpcCallsWrappedInPromiseResolve();
    testMinibossActivityTabWiredCorrectly();
    testCraftMiniBossParcheminNeedsFiveBooks();
    testPushSilverMinuteSampleBucketsAndPrunes();
    testBuildSilverPointsFillGapsWithZeros();
    testAddSilverFeedsMinuteHistoryOnlyForLoot();
    testSilverHistPanelOpensOfflineAndCloses();
    testAdvanceSimCatchesUpHiddenTimeInSubSteps();
    testComputeSlidingRatesUnfreezeRecordOnSustainedHigherRate();
    testSilverBalanceAndHoverHelpers();
    testSilverHistChartTooltipShowsOnHover();
    testRateRecordsResetV454ZeroesLocalRecords();
    testSyncPlayerStatsNoLongerPushesServerOwnedRateColumns();
    testLb2RateCatsRankByWeekAndShowBothValues();
    testOfflineCatchupPrefersServerRatesOverLocalRecord();
    testPetLooterActivationAndTaggedCollect();
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
