// ==================== OUTILS DEBUG ADMIN : ENCHANTEMENT ====================
// Extrait de inventory-ui.js le 2026-07-08 (reorganisation par dossiers) -- DOIT charger APRES
// inventory-ui.js (refreshEquipSlot/renderOptimization/drawPreviewChar) : boutons admin de
// debug pour forcer l'enchantement de tout le stuff equipe (max/reset/+-1 rang).
// outil de debug réservé à l'admin (2026-07-14, demande explicite : "ajoute un bouton dans
// l'inventaire passer toutes les pieces équipé a une stats d'opti juste pour admin") -- passe
// chaque pièce ÉQUIPÉE (arme/armure/bijou) directement à l'enchantement maximum (PEN). Ne touche
// PAS S.enhAttempts/S.enhSuccess (ce ne sont pas de vraies tentatives) ni markPenMastery (éviterait
// un faux log Discord "maîtrise PEN" et un faux déblocage de succès) -- mutation directe, aucun
// effet de bord au-delà des pièces elles-mêmes.
function adminMaxEnhAllEquipped() {
  const maxLvl = ENH_NAMES.length - 1;
  let count = 0;
  for (const slotId of Object.keys(EQUIP)) {
    const item = EQUIP[slotId];
    if (item && item.optimizable && (item.enhLv||0) < maxLvl) {
      item.enhLv = maxLvl;
      refreshEquipSlot(slotId);
      count++;
    }
  }
  if (count > 0) { hud(); renderOptimization(); drawPreviewChar(); }
  return count;
}
const adminMaxEnhBtnEl = $('btnAdminMaxEnh');
if (adminMaxEnhBtnEl) adminMaxEnhBtnEl.onclick = () => {
  if (typeof isAdmin === 'function' && !isAdmin()) return; // filet de sécurité : jamais actif hors admin, même si le bouton était visible par erreur
  const count = adminMaxEnhAllEquipped();
  const msg = $('equipBestMsg');
  if (msg) {
    msg.textContent = count > 0
      ? i18next.t('admin:admin.enh_debug.max_all', { count })
      : i18next.t('admin:admin.enh_debug.already_max');
    msg.className = 'ok';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};
// symétrique du bouton ci-dessus (2026-07-14, demande explicite : "ajoute un bouton tout
// rétrogradé") -- remet chaque pièce équipée à +0, même filet de sécurité et mêmes non-effets de
// bord (pas de compteur de tentative, pas de log/succès -- une rétrogradation n'en déclenche de
// toute façon jamais côté succès, seule une MONTÉE en déclenche via markPenMastery)
function adminResetEnhAllEquipped() {
  let count = 0;
  for (const slotId of Object.keys(EQUIP)) {
    const item = EQUIP[slotId];
    if (item && item.optimizable && (item.enhLv||0) > 0) {
      item.enhLv = 0;
      refreshEquipSlot(slotId);
      count++;
    }
  }
  if (count > 0) { hud(); renderOptimization(); drawPreviewChar(); }
  return count;
}
const adminResetEnhBtnEl = $('btnAdminResetEnh');
if (adminResetEnhBtnEl) adminResetEnhBtnEl.onclick = () => {
  if (typeof isAdmin === 'function' && !isAdmin()) return;
  const count = adminResetEnhAllEquipped();
  const msg = $('equipBestMsg');
  if (msg) {
    msg.textContent = count > 0
      ? i18next.t('admin:admin.enh_debug.reset_all', { count })
      : i18next.t('admin:admin.enh_debug.already_zero');
    msg.className = 'ok';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};
// pas fin d'1 rang dans un sens ou l'autre (2026-07-14, demande explicite : "ajoute retrograder de
// 1 rang augmenter de 1 rang") -- même filet de sécurité/non-effets de bord que les 2 boutons
// ci-dessus, juste bornés à [0, maxLvl] au lieu de sauter directement à une extrémité
function adminStepEnhAllEquipped(delta) {
  const maxLvl = ENH_NAMES.length - 1;
  let count = 0;
  for (const slotId of Object.keys(EQUIP)) {
    const item = EQUIP[slotId];
    if (!item || !item.optimizable) continue;
    const cur = item.enhLv||0, next = Math.max(0, Math.min(maxLvl, cur + delta));
    if (next === cur) continue;
    item.enhLv = next;
    refreshEquipSlot(slotId);
    count++;
  }
  if (count > 0) { hud(); renderOptimization(); drawPreviewChar(); }
  return count;
}
function wireAdminEnhStepBtn(id, delta, msgUpKey, msgNoneKey) {
  const el = $(id); if (!el) return;
  el.onclick = () => {
    if (typeof isAdmin === 'function' && !isAdmin()) return;
    const count = adminStepEnhAllEquipped(delta);
    const msg = $('equipBestMsg');
    if (msg) {
      msg.textContent = count > 0
        ? i18next.t(msgUpKey, { count })
        : i18next.t(msgNoneKey);
      msg.className = 'ok';
      setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
    }
  };
}
wireAdminEnhStepBtn('btnAdminEnhDown1', -1,
  'admin:admin.enh_debug.step_down_count', 'admin:admin.enh_debug.already_zero');
wireAdminEnhStepBtn('btnAdminEnhUp1', 1,
  'admin:admin.enh_debug.step_up_count', 'admin:admin.enh_debug.already_max');

// outil de debug admin (2026-07-18, demande explicite : "bouton admin changer tout le stuff d'un
// coup de tiers Bleu a vert et y mettre tout les tiers") -- équipe INSTANTANÉMENT un set complet
// (+0) du palier choisi : 7 pièces d'armure/armes générées avec les MÊMES formules que le vrai
// drop (rollGearDrop/rollWeaponDrop dans combat/loot-rolls.js, basis = la dernière zone du palier,
// la plus avancée) + les 6 bijoux (ring1/ring2/necklace/earring1/earring2/belt), reconstruits à
// partir du jackpot de CHAQUE zone du palier (chaque zone ne garantit qu'un seul type de bijou,
// voir ZONES -- ring1/ring2 et earring1/earring2 reçoivent donc 2 copies du même bijou, comme un
// joueur qui a fini par looter un doublon). Outil de test pur : aucun effet sur les succès/logs,
// pas de vraie "chute" de loot.
function adminEquipFullTierSet(grade) {
  const tier = GEAR_TIERS.find(t => t.grade === grade);
  if (!tier) return 0;
  const lastZone = ZONES[tier.zones[tier.zones.length-1]];
  const basisAP = lastZone.gearBasisAP ?? lastZone.reqAP, basisDP = lastZone.gearBasisDP ?? lastZone.reqDP;
  const TIER_COLORED_ICON = {
    helmet:helmetIconForColor, armor:armorIconForColor, gloves:glovesIconForColor, boots:bootsIconForColor,
    weapon:staffIconForColor, secondary:daggerIconForColor, awakening:orbPairIconForColor,
  };
  let count = 0;
  for (const slot of ['helmet','armor','gloves','boots','weapon','awakening','secondary']) {
    const role = GEAR_ROLE[slot];
    const ap = role.apShare ? gearFloor(basisAP * role.apShare) : 0;
    const dp = role.dpShare ? gearFloor(basisDP * role.dpShare) : 0;
    const hp = role.hpShare ? gearFloor(basisDP * role.hpShare * HP_GEAR_SCALE) : 0;
    const dodge = Math.round(basisDP * (role.dodgeShare||0) * DODGE_GEAR_SCALE * 100) / 100;
    EQUIP[slot] = {
      name: tier.sets[slot], kind:'gear', slot, ap, dp, hp, dodge, enhLv:0, optimizable:true, fsByLevel:{},
      key:'gear_'+tier.grade+'_'+slot+'_admin'+Math.random().toString(36).slice(2,7),
      icon: TIER_COLORED_ICON[slot](tier.color, tier.grade), color:tier.color, stackable:false, weight:1.2,
      matName: tier.material.name,
      val: Math.round((ap*2 + dp + hp*0.5) * GEAR_SELL_MULT),
    };
    count++;
  }
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const byBaseSlot = {};
  for (const zi of tier.zones) {
    const z = ZONES[zi], jp = z.loot.jackpot, baseSlot = accSlotFor(jp);
    const zBasisAP = z.gearBasisAP ?? z.reqAP;
    byBaseSlot[baseSlot] = {
      name: jp.name, kind:'jackpot', ap: gearFloor(zBasisAP * GEAR_ROLE.jackpot.apShare), dp:0, hp:0, dodge:0,
      enhLv:0, optimizable:true, fsByLevel:{}, color:tier.color, stackable:false, weight:0.5, matName:tier.material.name,
      icon: (JEWEL_ICON_FOR_SLOT[baseSlot]||ringIconForTier)(jTierIdx, tier.color),
      val: gearFloor(z.loot.trash.val * JACKPOT_VAL_TRASH_RATIO),
    };
  }
  const place = (slot, baseSlot) => {
    const tmpl = byBaseSlot[baseSlot]; if (!tmpl) return;
    EQUIP[slot] = { ...tmpl, key:'acc_'+tier.grade+'_'+slot+'_admin'+Math.random().toString(36).slice(2,7) };
    count++;
  };
  place('ring1','ring'); place('ring2','ring');
  place('earring1','earring'); place('earring2','earring');
  place('necklace','necklace'); place('belt','belt');
  hud(); renderEquipment(); refreshInvUI(); drawPreviewChar();
  return count;
}
const adminEquipTierBtnEl = $('btnAdminEquipTier');
if (adminEquipTierBtnEl) adminEquipTierBtnEl.onclick = () => {
  if (typeof isAdmin === 'function' && !isAdmin()) return; // filet de sécurité : jamais actif hors admin
  const sel = $('admTierSelect'); if (!sel) return;
  const count = adminEquipFullTierSet(sel.value);
  const msg = $('equipBestMsg');
  if (msg) {
    const tierObj = GEAR_TIERS.find(t => t.grade === sel.value);
    const tierName = tierObj ? tierObj.label[LANG] : sel.value;
    msg.textContent = count > 0
      ? i18next.t('admin:admin.enh_debug.equip_tier_success', { tierName, count })
      : i18next.t('admin:admin.enh_debug.tier_not_found');
    msg.className = 'ok';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};
