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
      ? (LANG==='fr' ? `${count} pièce${count>1?'s':''} passée${count>1?'s':''} en Optimisation max` : `${count} piece${count>1?'s':''} set to max Enhancement`)
      : (LANG==='fr' ? 'Déjà toutes au maximum' : 'Already all at max');
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
      ? (LANG==='fr' ? `${count} pièce${count>1?'s':''} rétrogradée${count>1?'s':''} à +0` : `${count} piece${count>1?'s':''} reset to +0`)
      : (LANG==='fr' ? 'Déjà toutes à +0' : 'Already all at +0');
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
function wireAdminEnhStepBtn(id, delta, msgUpFr, msgUpEn, msgNoneFr, msgNoneEn) {
  const el = $(id); if (!el) return;
  el.onclick = () => {
    if (typeof isAdmin === 'function' && !isAdmin()) return;
    const count = adminStepEnhAllEquipped(delta);
    const msg = $('equipBestMsg');
    if (msg) {
      msg.textContent = count > 0
        ? (LANG==='fr' ? `${count} ${msgUpFr}` : `${count} ${msgUpEn}`)
        : (LANG==='fr' ? msgNoneFr : msgNoneEn);
      msg.className = 'ok';
      setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
    }
  };
}
wireAdminEnhStepBtn('btnAdminEnhDown1', -1,
  'pièce(s) rétrogradée(s) d\'1 rang', 'piece(s) downgraded by 1 rank',
  'Déjà toutes à +0', 'Already all at +0');
wireAdminEnhStepBtn('btnAdminEnhUp1', 1,
  'pièce(s) augmentée(s) d\'1 rang', 'piece(s) upgraded by 1 rank',
  'Déjà toutes au maximum', 'Already all at max');
