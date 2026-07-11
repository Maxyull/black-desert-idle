// ==================== TRESOR DE VELIA (craft) ====================
// Extrait de game-core.js le 2026-07-08 (reorganisation par dossiers) -- DOIT charger APRES
// core/game-core.js (utilise INV/addSilver/Z()/GEAR_ROLE/etc., tous definis a l'execution -- pas
// de dependance au chargement immediat au-dela de ca).
const VELIA_TREASURE = [
  { name:'Bout du trésor de Velia', ch:.0017,   icon:'🧩', color:'#c9a55a', key:'treasure_bout_velia' }, // 0.17% (2026-07-13, demande explicite)
  { name:'Trésor de Velia',         ch:.000005, icon:'🗺️', color:'#e8c96a', key:'treasure_velia' },      // 0.0005% (2026-07-13, demande explicite)
];
/**
 * Total de morceaux du Trésor de Velia ramassés À VIE (lifetime, via S.lootByItem) — utilisé par
 * les succès et le classement dédié.
 * @param {object} S - état de sauvegarde, lit S.lootByItem[name] pour chaque entrée de VELIA_TREASURE.
 * @returns {number} somme des quantités ramassées, toutes entrées confondues.
 */
function treasureTotal(S) {
  let total = 0;
  for (const t of new Set(VELIA_TREASURE.map(x => x.name))) total += S.lootByItem[t] || 0;
  return total;
}
/**
 * "Prix d'un équipement" de référence pour tarifer le Trésor de Velia — réutilise TELLE QUELLE la
 * formule de valeur d'une pièce d'armure de rollGearDrop (même palier/zone que celle où le trésor
 * est looté), pour rester automatiquement à jour si GEAR_SELL_MULT ou les stats de zone changent
 * (préférer une formule dynamique à un chiffre figé — rebalance = rétroactif automatique).
 * @returns {number} valeur silver de référence, basée sur la zone/palier actuels du joueur.
 */
function referenceGearVal() {
  const zone = Z(), tier = gearTierForZone(zoneIdx);
  const basisAP = zone.gearBasisAP ?? zone.reqAP, basisDP = zone.gearBasisDP ?? zone.reqDP;
  const slot = (ZONE_ARMOR_SLOTS[zoneIdx] || GEAR_SLOTS)[0];
  const role = GEAR_ROLE[slot];
  const ap = role.apShare ? gearFloor(basisAP * role.apShare) : 0;
  const dp = role.dpShare ? gearFloor(basisDP * role.dpShare) : 0;
  const hp = role.hpShare ? gearFloor(basisDP * role.hpShare * HP_GEAR_SCALE) : 0;
  return Math.round((ap*2 + dp + hp*0.5) * GEAR_SELL_MULT);
}
// plafond d'empilement en sac (2026-07-13, demande explicite) : au-delà, le surplus est vendu
// automatiquement (voir enforceTreasureStackCap, appelé depuis invAdd) plutôt que de bloquer le
// ramassage ou de remplir le sac indéfiniment.
const TREASURE_STACK_CAP = { treasure_bout_velia:100, treasure_velia:1 };
/** @param {object} slot - slot d'inventaire (kind:'treasure'). Vend automatiquement le surplus au-delà de TREASURE_STACK_CAP au lieu de bloquer le ramassage ou de remplir le sac. Appelé depuis invAdd. */
function enforceTreasureStackCap(slot) {
  if (!slot || slot.kind !== 'treasure') return;
  const cap = TREASURE_STACK_CAP[slot.key]; if (!cap) return;
  if (slot.qty > cap) {
    const excess = slot.qty - cap;
    addSilver(excess * (slot.val||0), 'sell', slot.name);
    slot.qty = cap;
  }
}

// ---------- conversion du Trésor de Velia (craft) — demande explicite du 2026-07-08 ----------
// 100 "Bout du trésor de Velia" → 1 "Trésor de Velia".
const TREASURE_PIECE_RECIPES = [
  { needKey:'treasure_bout_velia', needQty:100, giveName:'Trésor de Velia', giveKey:'treasure_velia' },
];
/** @param {string} key - clé d'item. @returns {number} index du slot INV portant cette clé, -1 si absent. */
function invSlotByKey(key) { return INV.findIndex(s => s && s.key === key); }
/** @param {string} key - clé d'item. @returns {number} quantité possédée (0 si absent). */
function invQtyByKey(key) { const i = invSlotByKey(key); return i===-1 ? 0 : INV[i].qty; }
// une place est déjà garantie si l'objet résultant a déjà un stack existant (il fusionne dedans) —
// sinon il faut une case vide, comme n'importe quel nouvel objet
/** @param {string} key - clé d'item résultant du craft. @returns {boolean} vrai si un stack existant ou une case vide est disponible. */
function invHasRoomFor(key) { return invSlotByKey(key) !== -1 || invUsed() < INV_SIZE; }
/** @param {object} recipe - entrée de TREASURE_PIECE_RECIPES. @returns {boolean} vrai si craft effectué (retire needQty, ajoute 1 giveName), false si ingrédients insuffisants ou sac plein. */
function craftTreasurePiece(recipe) {
  if (invQtyByKey(recipe.needKey) < recipe.needQty) return false;
  if (!invHasRoomFor(recipe.giveKey)) { floatTxt(P.x,P.y,90,i18next.t('progression:progression.treasure_craft.bag_full'),{hurt:true}); return false; }
  invRemoveAt(invSlotByKey(recipe.needKey), recipe.needQty);
  invAdd({ name:recipe.giveName, kind:'treasure', icon:'🗺️', color:'#e8c96a', key:recipe.giveKey, qty:1, stackable:true, weight:0.05, val:referenceGearVal()*10000, ap:0, dp:0, hp:0, dodge:0 });
  trackLoot(recipe.giveName);
  floatTxt(P.x,P.y,90,'🗺️ '+recipe.giveName,{gold:true});
  logToDiscord('🔧 Craft', `**${myPseudo||'Joueur'}** combine ${recipe.needQty} morceaux en 1 ${recipe.giveName}`, 0xe8c96a);
  renderInventory();
  return true;
}
// recette "secrète" (2026-07-15, demande explicite : "ajoute un combiner 3 carte differente =
// secret") : combine 1 Bout du trésor de Velia + 1 matériau d'optimisation (n'importe lequel) + 1
// bijou (n'importe lequel) — 3 objets de nature DIFFÉRENTE, contrairement à la recette ci-dessus
// qui empile 100 fois le MÊME objet — contre une récompense en silver immédiate. Le montant
// (référence × 300) reste loin en dessous de la conversion complète en Trésor de Velia (référence
// × 10000 pour 100 morceaux) : un bonus notable mais qui ne concurrence pas la vraie progression du
// Trésor, seulement un moyen de valoriser un bijou/matériau isolé qu'on aurait sinon juste vendu.
// Ingrédients changés le 2026-07-15 (demande explicite : "tresor de velia / tresor de heilde /
// tresors de calpheon / donne coffret secret") -- c'était le sens original de "combiner 3 cartes
// différentes" demandé bien plus tôt dans la session : les 3 Trésors RÉGIONAUX complets (pas Bout +
// matériau + bijou comme la 1ère version). Tant que Heidel/Calpheon restent verrouillés (voir
// TIER_PREVIEW_CARD), cette recette reste non complétable EN PRATIQUE -- ce n'est pas un bug, ces 2
// ingrédients n'existent tout simplement pas encore en jeu.
const SECRET_COMBO_SILVER_MULT = 300;
/** @returns {boolean} vrai si le joueur possède les 3 Trésors régionaux (Velia/Heidel/Calpheon) nécessaires au coffret secret. */
function secretComboReady() {
  return invSlotByKey('treasure_velia') !== -1
    && invSlotByKey('treasure_heidel') !== -1
    && invSlotByKey('treasure_calpheon') !== -1;
}
/** @returns {boolean} vrai si combiné (consomme les 3 Trésors régionaux, verse referenceGearVal()×SECRET_COMBO_SILVER_MULT en silver), false si ingrédients manquants. */
function craftSecretCombo() {
  const vIdx = invSlotByKey('treasure_velia');
  const hIdx = invSlotByKey('treasure_heidel');
  const cIdx = invSlotByKey('treasure_calpheon');
  if (vIdx === -1 || hIdx === -1 || cIdx === -1) return false;
  invRemoveAt(vIdx, 1); invRemoveAt(hIdx, 1); invRemoveAt(cIdx, 1);
  const reward = Math.round(referenceGearVal() * SECRET_COMBO_SILVER_MULT);
  // catégorie 'loot' (pas 'craft', absente de la whitelist CHECK de silver_ledger posée par
  // l'audit de sécurité du 2026-07-14 -- voir supabase/migrations/20260714171000_...) : un
  // gain via cette recette reste un revenu en jeu, la catégorie la plus proche déjà autorisée
  addSilver(reward, 'loot', 'Coffret secret');
  floatTxt(P.x,P.y,90,'🎁 +'+fmt(reward),{gold:true});
  logToDiscord('🎁 Coffret secret', `**${myPseudo||'Joueur'}** combine les 3 Trésors régionaux pour ${fmt(reward)} silver`, 0xe8c96a);
  renderInventory();
  return true;
}
// panneau de craft affiché SEULEMENT dans l'onglet "Trésors" de l'inventaire (voir renderInventory)
/** Reconstruit le panneau de craft (onglet Trésors) : recettes disponibles, coffret secret, emplacements verrouillés Heidel/Calpheon — câble les clics. */
function renderTreasureCraftPanel() {
  // affiché en permanence dans la carte "Optimisation & Craft" (2026-07-08) — avant ce correctif,
  // ce panneau ne s'affichait QUE quand l'onglet "Trésors" de l'inventaire était ouvert, un reste
  // de l'époque où il vivait DANS la carte Inventaire ; il restait donc invisible la plupart du temps
  const el = $('treasureCraftPanel'); if (!el) return;
  const pieceRows = TREASURE_PIECE_RECIPES.map(r => {
    const have = invQtyByKey(r.needKey);
    const ok = have >= r.needQty;
    return `<button class="craftRecipeBtn${ok?' ready':''}" data-kind="piece" data-key="${r.needKey}" ${ok?'':'disabled'}>` +
      `🧩 ${have}/${r.needQty} → 🗺️ ${escapeHtml(r.giveName)}</button>`;
  }).join('');
  const secretOk = secretComboReady();
  const secretRow = `<button class="craftRecipeBtn${secretOk?' ready':''}" data-kind="secret" ${secretOk?'':'disabled'} ` +
    `title="${i18next.t('progression:progression.treasure_craft.secret_combo_hint')}">` +
    `🗺️+🗺️+🗺️ → 🎁 ${i18next.t('progression:progression.treasure_craft.secret_box_label')}</button>`;
  // recettes verrouillées "100 fragment → 1 carte" pour Heidel/Calpheon (2026-07-15, demande
  // explicite : "ajoute 2 crafte /100 > carte") -- aucun fragment n'est obtenable tant que ces
  // paliers restent verrouillés (voir TIER_PREVIEW_CARD/ZONE_TIERS), donc affichées grisées comme
  // les autres emplacements verrouillés du jeu (Consommable/RNG...), prêtes pour le jour où le
  // palier ouvrira -- toujours "0/100", jamais cliquables.
  const upcomingRows = Object.entries(TIER_PREVIEW_CARD).map(([tierId, card]) => {
    const tierLabel = ZONE_TIERS.find(t => t.id === tierId).label[LANG];
    return `<button class="craftRecipeBtn" disabled title="${i18next.t('progression:progression.treasure_craft.upcoming_tier_hint', { tier: tierLabel })}">` +
      `🔒 🧩 0/100 → ${card.icon} ${escapeHtml(tr(card.name))}</button>`;
  }).join('');
  el.innerHTML = `<div class="craftPanelTitle">${i18next.t('progression:progression.treasure_craft.panel_title')}</div>` +
    `<div class="craftRecipes">${pieceRows}${secretRow}${upcomingRows}</div>`;
  el.querySelectorAll('.craftRecipeBtn[data-kind="piece"]').forEach(btn => {
    btn.onclick = () => { const r = TREASURE_PIECE_RECIPES.find(x => x.needKey === btn.dataset.key); if (r) craftTreasurePiece(r); renderTreasureCraftPanel(); };
  });
  const secretBtn = el.querySelector('.craftRecipeBtn[data-kind="secret"]');
  if (secretBtn) secretBtn.onclick = () => { craftSecretCombo(); renderTreasureCraftPanel(); };
}
