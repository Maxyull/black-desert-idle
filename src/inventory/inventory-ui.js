// ==================== INVENTAIRE / ÉQUIPEMENT — UI ====================
const invPanelOpen = true; // panneau toujours affiché

// ---------- équipement (paperdoll permanent) ----------
const PD_LEFT  = ['helmet','armor','gloves','boots'];
// réorganisé le 2026-07-14 (demande explicite : "a droite collier 2 bague 2 oreille en bas en
// dessous des armes 2 artefact 1 pierre d'alchimie 1 livre") -- artéfacts/pierre/livre déplacés
// sous les armes (voir #pdBook ci-dessous), la colonne de droite ne garde plus que
// collier/bagues/boucles d'oreille/ceinture
const PD_RIGHT = ['necklace','ring1','ring2','earring1','earring2','belt'];
const PD_BOTTOM = ['weapon','awakening','secondary'];
const SLOT_LABEL = { weapon:'Arme princ.', awakening:'Éveil', secondary:'Arme secondaire', book:'Livre (vie)',
  helmet:'Casque', armor:'Armure', gloves:'Gants', boots:'Bottes',
  necklace:'Collier', earring1:'B. oreille', earring2:'B. oreille', ring1:'Bague', ring2:'Bague', belt:'Ceinture',
  artifact1:'Artéfact', artifact2:'Artéfact', eqStone:'Pierre d\'alchimie' };
// icônes par défaut (palier neutre gris) — utilisées en repli quand une pièce sauvegardée n'a pas
// sa propre icône (vieux objets, stuff de départ), voir helmetIconForColor & co. plus haut
const SLOT_ICON = { weapon:staffIconForColor('#8f9aa6','grey'), awakening:orbPairIconForColor('#8f9aa6','grey'),
  secondary:daggerIconForColor('#8f9aa6','grey'), book:ICO_BOOK,
  helmet:helmetIconForColor('#8f9aa6','grey'), armor:armorIconForColor('#8f9aa6','grey'),
  gloves:glovesIconForColor('#8f9aa6','grey'), boots:bootsIconForColor('#8f9aa6','grey'),
  necklace:necklaceIconForTier(0,'#8f9aa6'), earring1:earringIconForTier(0,'#8f9aa6'), earring2:earringIconForTier(0,'#8f9aa6'),
  ring1:ringIconForTier(0,'#8f9aa6'), ring2:ringIconForTier(0,'#8f9aa6'), belt:ICO_BELT,
  artifact1:ICO_ARTIFACT, artifact2:ICO_ARTIFACT, eqStone:ICO_EQSTONE };

function renderEquipment() {
  drawPreviewChar();
  fillPdCol('pdLeft', PD_LEFT);
  fillPdCol('pdRight', PD_RIGHT);
  fillPdCol('pdWeapons', PD_BOTTOM);
  // artéfacts/pierre d'alchimie/livre regroupés sous les armes (2026-07-14, demande explicite,
  // voir commentaire sur PD_RIGHT ci-dessus) -- avant, seul le livre y était, les artéfacts/pierre
  // vivaient dans la colonne de droite
  fillPdCol('pdBook', ['artifact1','artifact2','eqStone','book']);
  // les stats vont dans la carte Statistiques (pas de doublon)
  $('stWeaponBonus').textContent = '+' + Math.round(enhBonus(EQUIP.weapon ? EQUIP.weapon.enhLv : 0) * 100) + '%';
  $('stArmorBonus').textContent = '+' + Math.round(armorBonusAvg() * 100) + '%';
  // résumé PA/PD/GS directement sur la carte Équipement — demande explicite (entier, arrondi vers
  // le bas — 2026-07-08, voir le commentaire sur $('stPA') plus haut)
  // préfixe PA/PD codé en dur en français jusqu'ici, même en anglais (2026-07-14, découvert lors
  // d'une vérif des stats) -- corrigé pour suivre LANG, comme le préfixe "Niv."/"Lvl" juste au-dessus
  $('eqSumAp').textContent = (LANG==='fr'?'PA ':'AP ') + Math.floor(apEff());
  $('eqSumDp').textContent = (LANG==='fr'?'PD ':'DP ') + Math.floor(totalDP());
  $('eqSumGs').textContent = 'GS ' + Math.round(GS());
}
// libellé court du niveau d'optimisation : "+N" jusqu'à +15, puis chiffres romains I..V pour PRI..PEN
function enhShortLabel(lvl) {
  if (lvl < PRI_IDX) return '+' + lvl;
  return ['I','II','III','IV','V'][lvl - PRI_IDX] || '+' + lvl;
}
function pdSlotInnerHtmlFor(id, e) {
  const icon = (e ? (e.icon || SLOT_ICON[id]) : SLOT_ICON[id]);
  let badge = '';
  if (e && e.optimizable) {
    const lvl = e.enhLv || 0;
    badge = `<span class="enh${lvl>=PRI_IDX?' pri':''}">${enhShortLabel(lvl)}</span>`;
  } else if (e && e.ap) {
    badge = `<span class="enh">+${e.ap}</span>`;
  }
  // PA/PD directement sur la pièce équipée, toujours en bas-gauche (2026-07-09, demande explicite :
  // "sur l'armure met la dp en bas a gauche") -- AP et PD ne sont jamais tous les deux non-nuls sur
  // le même objet (voir GEAR_ROLE : apShare/dpShare s'excluent selon le type de pièce), donc les
  // deux badges peuvent partager la même position sans jamais se chevaucher ; ça libère le
  // bas-droite pour la croix de déséquipement ci-dessous
  let apDpBadge = '';
  if (e) {
    const { ap, dp } = effectiveApDp(e);
    if (ap) apDpBadge += `<span class="pdAp">${ap}</span>`;
    if (dp) apDpBadge += `<span class="pdDp">${dp}</span>`;
  }
  // petit bouton "optimiser" directement sur la pièce équipée (2026-07-05, demande explicite :
  // "petit mais visible") -- raccourci vers le panneau d'optimisation, en plus du menu au clic
  const optBadge = (e && e.optimizable) ? `<span class="pdOptBtn" title="${LANG==='fr'?'Optimiser':'Enhance'}">🔧</span>` : '';
  // icône "aller à la zone" en coin, EMPILÉE sous 🔧 (2026-07-09, demande explicite : "opti en
  // haut à droite, upgrade sous l'icone d'opti") : ⬆️ sur une case remplie, UNIQUEMENT s'il existe
  // un vrai stuff meilleur à trouver (voir upgradeZonesForEquippedSlot : palier de la pièce
  // équipée strictement inférieur au palier de la zone actuelle), dans une zone NON dangereuse,
  // différente de la zone actuelle (demandes explicites successives) ; MÊME icône ⬆️ sur une case
  // vide (2026-07-09, demande explicite : "ajoute l'icone d'upgrade sur les case vide" -- un socle
  // vide EST par définition à améliorer, langage visuel cohérent), dangereux accepté en dernier
  // recours faute d'alternative ; 🔒 sur les 3 slots sans aucune source en jeu (artéfacts/pierre)
  let goBadge = '';
  if (e) {
    if (upgradeZonesForEquippedSlot(id, e).length) goBadge = `<span class="pdUpgradeBtn" title="${LANG==='fr'?'Zone pour améliorer':'Zone to upgrade'}">⬆️</span>`;
  } else if (NO_SOURCE_SLOTS.includes(id)) {
    goBadge = `<span class="pdLockBtn" title="${LANG==='fr'?'Pas encore disponible':'Not available yet'}">🔒</span>`;
  } else if (zonesForSlot(id).length) {
    // même icône ⬆️ que pour un socle rempli (2026-07-09, demande explicite : "ajoute l'icone
    // d'upgrade sur les case vide") -- un socle vide EST par définition à améliorer, même symbole
    // pour un langage visuel cohérent dans toute l'interface
    goBadge = `<span class="pdFarmBtn" title="${LANG==='fr'?'Zone pour trouver ce stuff':'Zone to find this gear'}">⬆️</span>`;
  }
  const cornerHtml = (optBadge || goBadge) ? `<span class="pdCorner">${optBadge}${goBadge}</span>` : '';
  // croix de déséquipement en bas-droite (2026-07-09, demande explicite) — raccourci direct en
  // plus du double-clic déjà existant sur la case
  const unequipBadge = e ? `<span class="pdUnequipBtn" title="${LANG==='fr'?'Déséquiper':'Unequip'}">✕</span>` : '';
  return icon + badge + apDpBadge + cornerHtml + unequipBadge;
}
function pdSlotInnerHtml(id) { return pdSlotInnerHtmlFor(id, EQUIP[id]); }
// texte "+X PA +Y PD +Z PV" affiché dans le tooltip d'une pièce de la poupée d'équipement —
// demande explicite : voir ce que le stuff donne comme PA/PD directement sur l'équipement
function pdStatSuffix(e) {
  const { ap, dp, hp, dodge } = effectiveApDp(e);
  const parts = [];
  if (ap) parts.push('+'+ap+' PA');
  if (dp) parts.push('+'+dp+' PD');
  if (hp) parts.push('+'+hp+' PV');
  if (dodge) parts.push('+'+dodge+'% Esq.');
  return parts.length ? ' (' + parts.join(' ') + ')' : '';
}
// base de comparaison ("ring"/"earring"/"necklace"/"belt") pour un slot précis de la poupée —
// les paires (ring1/ring2, earring1/earring2) partagent le même bassin de candidats
function accBaseSlot(slotId) {
  if (slotId==='ring1'||slotId==='ring2') return 'ring';
  if (slotId==='earring1'||slotId==='earring2') return 'earring';
  return slotId;
}
// slots sans aucune source en jeu pour l'instant — affichés avec un cadenas 🔒 plutôt qu'une
// case vide muette (demande explicite du 2026-07-09)
const NO_SOURCE_SLOTS = ['artifact1','artifact2','eqStone'];
// bijoux (bagues/collier/boucles/ceinture) — utilisé pour colorer le cadre de la case selon le
// palier du bijou équipé (2026-07-09, demande explicite : "ajoute la couleur du cadre des bijoux")
const JEWELRY_SLOTS = ['ring1','ring2','necklace','earring1','earring2','belt'];
// zones candidates pour farmer/upgrader un socle donné, AVANT tout filtre de sécurité — se base
// sur le palier de la zone actuellement farmée (zoneIdx) : armes → zones qui garantissent ce type
// d'arme (ZONE_WEAPON_SLOTS) ; armures → la zone UNIQUE du palier qui garantit CETTE pièce
// précise (ZONE_ARMOR_SLOTS, corrigé le 2026-07-12 -- voir commentaire ci-dessous) ; bijoux → la
// zone UNIQUE du palier dont le jackpot correspond à ce type (ring/necklace/belt/earring, voir
// accSlotFor). artifact1/artifact2/eqStone → jamais de résultat (voir NO_SOURCE_SLOTS).
// BUG corrigé le 2026-07-12 (demande explicite : "montrer dans l'inventaire uniquement les items
// qui se lootent dans la zone... zone casque -> icône SEULEMENT sur le casque") : cette fonction
// renvoyait TOUTES les zones du palier pour n'importe quelle pièce d'armure ("n'importe laquelle
// peut looter n'importe quelle pièce"), un reliquat de l'ancien système d'AVANT ZONE_ARMOR_SLOTS
// (qui garantit désormais EXACTEMENT 1 pièce par zone, voir rollGearDrop et
// testZoneWeaponArmorSlotsComplete) — jamais mis à jour, ce qui cassait toute tentative de lier
// une zone précise à SON socle précis (une pièce d'armure ne peut en réalité dropper QUE dans SA
// zone dédiée, jamais ailleurs dans le palier).
function slotCandidateZones(slotId) {
  const tier = gearTierForZone(zoneIdx);
  if (WEAPON_SLOTS.includes(slotId)) {
    return tier.zones.filter(zi => (ZONE_WEAPON_SLOTS[zi]||[]).includes(slotId));
  } else if (ARMOR_SLOTS.includes(slotId)) {
    return tier.zones.filter(zi => (ZONE_ARMOR_SLOTS[zi]||[]).includes(slotId));
  } else if (JEWELRY_SLOTS.includes(slotId)) {
    const base = accBaseSlot(slotId);
    return tier.zones.filter(zi => accSlotFor(ZONES[zi].loot.jackpot) === base);
  }
  return [];
}
// variante de slotCandidateZones qui cherche dans TOUS les paliers, pas seulement celui de la zone
// actuellement farmée (2026-07-15, bug corrigé : voir upgradeZonesForEquippedSlot ci-dessous) --
// réservée au cas du socle REMPLI (safeZonesForSlot), slotCandidateZones reste inchangée pour le
// socle VIDE (zonesForSlot, "où farmer" : rester scopé au palier courant y est voulu, on ne veut
// pas suggérer un palier inférieur déjà dépassé).
function slotCandidateZonesAllTiers(slotId) {
  const allZoneIdx = ZONES.map((_, zi) => zi);
  if (WEAPON_SLOTS.includes(slotId)) {
    return allZoneIdx.filter(zi => (ZONE_WEAPON_SLOTS[zi]||[]).includes(slotId));
  } else if (ARMOR_SLOTS.includes(slotId)) {
    return allZoneIdx.filter(zi => (ZONE_ARMOR_SLOTS[zi]||[]).includes(slotId));
  } else if (JEWELRY_SLOTS.includes(slotId)) {
    const base = accBaseSlot(slotId);
    return allZoneIdx.filter(zi => accSlotFor(ZONES[zi].loot.jackpot) === base);
  }
  return [];
}
// zones à proposer pour un socle VIDE (popup "où farmer") — demande explicite : "un socle
// d'équipement vide, lorsque tu cliques dessus, te montre où farm l'item... halo bien visible,
// tout sauf zone dangereuse". Ne recommande une zone DANGEREUSE que s'il n'existe vraiment aucune
// alternative plus sûre (sinon le joueur n'a aucune option affichée du tout).
function zonesForSlot(slotId) {
  const zones = slotCandidateZones(slotId);
  const safe = zones.filter(zi => bottleneck(ZONES[zi]) >= 0.6);
  return safe.length ? safe : zones;
}
// zones à proposer pour l'icône ⬆️ d'un socle REMPLI — demande explicite du 2026-07-09 : cette
// icône ne doit s'afficher que s'il existe un endroit pour mieux se stuffer qui N'EST PAS une zone
// dangereuse (pas de fallback sur le dangereux ici, contrairement à zonesForSlot).
// Le filtre sur les zones DÉCOUVERTES (ajouté le 2026-07-11, zi <= S.maxZoneIdx) a été RETIRÉ le
// 2026-07-12 (demande explicite : "si un meilleur stuff base est disponible au loot, le montrer...
// toute zone SAUF dangereuse") -- revirement assumé : propose à nouveau TOUTES les zones du jeu
// (même jamais visitées), en excluant uniquement les zones dangereuses.
// Cherche désormais dans TOUS les paliers (slotCandidateZonesAllTiers), pas seulement celui de la
// zone actuellement farmée (2026-07-15, bug corrigé : "je suis en zone verte, accès difficile zone
// bleu, je devrais avoir une icône qui me montre que du stuff m'attend" -- avant, scopé au palier
// courant via slotCandidateZones, un palier SUPÉRIEUR ne pouvait jamais être suggéré, quel que soit
// le palier de la pièce déjà équipée).
function safeZonesForSlot(slotId) {
  return slotCandidateZonesAllTiers(slotId).filter(zi => bottleneck(ZONES[zi]) >= 0.6);
}
// index de palier d'un objet équipé (grey=0 < white=1 < green=2 < blue=3), déduit de sa couleur —
// voir GEAR_TIERS (gear ET jackpot sont toujours tagués color:tier.color au drop). -1 si la
// couleur ne correspond à aucun palier connu.
function itemTierIdx(item) { return GEAR_TIERS.findIndex(t => t.color === item.color); }
// zones à proposer pour l'icône ⬆️ d'un socle REMPLI — demande explicite du 2026-07-09 : "l'icone
// s'affiche uniquement [si] tu peux trouver un stuff meilleur que celui que tu as déjà, SAUF
// dangereuse".
// BUG corrigé le 2026-07-15 (demande explicite : "je suis en zone verte, acces difficile zone
// bleu je devrais avoir un icone qui me montre que du stuff m'attend... verifie pour les autres
// grades") : la comparaison se faisait contre le palier de la zone ACTUELLEMENT FARMÉE
// (gearTierForZone(zoneIdx)), pas contre le palier de CHAQUE zone candidate. Résultat : un joueur
// en stuff vert qui farme une zone verte (itemTier=2, curTier=2) ne voyait JAMAIS l'icône, même
// si une zone bleue (palier 3, strictement meilleure) était sûre et accessible -- le palier de la
// zone qu'on farme n'a aucun rapport avec le palier des zones qu'on POURRAIT viser ensuite.
// Corrigé en comparant le palier de CHAQUE zone candidate individuellement au palier de la pièce
// équipée, ce qui généralise correctement à toutes les transitions de palier (gris→blanc,
// blanc→vert, vert→bleu), pas seulement au cas testé initialement.
function upgradeZonesForEquippedSlot(id, e) {
  if (!e) return [];
  const eTier = itemTierIdx(e);
  return safeZonesForSlot(id).filter(zi => (atVelia || zi !== zoneIdx) && GEAR_TIERS.indexOf(gearTierForZone(zi)) > eTier);
}
// un objet qui améliorerait ce socle est-il déjà possédé, non équipé, dans le sac ? (2026-07-11,
// demande explicite : "la flèche qui affiche le stuff à farm sur la zone ne doit pas s'afficher si
// le stuff est dans l'inventaire") -- si oui, inutile de suggérer d'aller le farmer, il suffit de
// l'équiper. Réutilise refScoreForSlot (même référence -- le pire des 2 anneaux/boucles pour une
// paire, -1 pour un socle vide -- que hasNeglectedUpgradeInBag) plutôt que de la recalculer.
function ownedBetterInBagForSlot(slotId) {
  const accSlot = JEWELRY_SLOTS.includes(slotId) ? accBaseSlot(slotId) : null;
  const ref = refScoreForSlot(slotId, accSlot);
  const wantSlot = accSlot || slotId;
  return INV.some(it => it && (it.kind==='gear' || it.kind==='jackpot') && it.slot === wantSlot && itemScore(it) > ref);
}
// ensemble des zones (sûres uniquement) qui offrent vraiment mieux pour AU MOINS un socle du
// joueur (vide, ou équipé d'un palier inférieur) — sert au badge ⬆️ affiché directement sur les
// lignes de la liste de zones (2026-07-09, demande explicite : "ajoute l'icone d'upgrade sur les
// case vide, et sur les zone en question"), en plus de l'icône déjà présente sur la poupée
// d'équipement elle-même.
function zonesOfferingUpgrade() {
  const zones = new Set();
  for (const slotId of [...WEAPON_SLOTS, ...ARMOR_SLOTS, ...JEWELRY_SLOTS]) {
    if (ownedBetterInBagForSlot(slotId)) continue; // déjà en stock -> équiper, pas farmer
    const e = EQUIP[slotId];
    const list = e ? upgradeZonesForEquippedSlot(slotId, e) : zonesForSlot(slotId).filter(zi => bottleneck(ZONES[zi]) >= 0.6);
    list.forEach(zi => zones.add(zi));
  }
  return zones;
}
// lien INVERSE de zonesOfferingUpgrade (2026-07-12, demande explicite : "montrer dans l'inventaire
// UNIQUEMENT les items qui se lootent dans la zone... si plusieurs zones sont disponibles... je
// peux montrer plusieurs flèches sur stuff ET zone à farm") : pour UNE zone donnée, quels socles
// précis de la poupée d'équipement propose-t-elle réellement en amélioration ? Sert à ne surligner
// QUE les cases concernées (pas toute la poupée) au survol d'une ligne de zone.
function slotsUpgradedByZone(zi) {
  const slots = [];
  for (const slotId of [...WEAPON_SLOTS, ...ARMOR_SLOTS, ...JEWELRY_SLOTS]) {
    if (ownedBetterInBagForSlot(slotId)) continue; // déjà en stock -> équiper, pas farmer
    const e = EQUIP[slotId];
    const list = e ? upgradeZonesForEquippedSlot(slotId, e) : zonesForSlot(slotId).filter(z => bottleneck(ZONES[z]) >= 0.6);
    if (list.includes(zi)) slots.push(slotId);
  }
  return slots;
}
// applique/retire le halo sur les cases de la poupée d'équipement concernées par UNE zone précise
function highlightEquipSlotsForZone(slots) {
  document.querySelectorAll('.pdSlot').forEach(el => el.classList.remove('pdFarmZoneHalo'));
  slots.forEach(id => { const el = document.querySelector(`.pdSlot[data-slot="${id}"]`); if (el) el.classList.add('pdFarmZoneHalo'); });
}
// applique/retire le halo dans #zoneList pour les zones qui lootent l'objet manquant d'un socle vide
function highlightFarmZones(zones) {
  document.querySelectorAll('#zoneList .zRow').forEach(r => r.classList.remove('eqFarmHalo'));
  zones.forEach(zi => { const row = document.querySelector(`#zoneList .zRow[data-zi="${zi}"]`); if (row) row.classList.add('eqFarmHalo'); });
}
// clic simple sur une case de la poupée d'équipement — demande explicite du 2026-07-09 : une case
// équipée n'affiche plus QUE le nom + les stats (déséquiper/optimiser restent accessibles via le
// double-clic et le bouton 🔧 dédiés) ; une case vide n'affiche plus QUE le nom + où farmer
function showEquipSlotMenu(cell, slotId) {
  const e = EQUIP[slotId];
  const pop = $('itemPop');
  let html = `<div class="ipName gear">${SLOT_LABEL[slotId] || slotId}</div>`;
  const emptyTxt = NO_SOURCE_SLOTS.includes(slotId)
    ? (LANG==='fr'?'🔒 Pas encore disponible':'🔒 Not available yet')
    : (LANG==='fr'?'Rien d\'équipé':'Nothing equipped');
  html += `<div class="ipDesc">${e ? (escapeHtml(e.name)+pdStatSuffix(e)) : emptyTxt}</div>`;
  pop.innerHTML = html;
  let farmZones = [];
  if (!e && !NO_SOURCE_SLOTS.includes(slotId)) {
    farmZones = zonesForSlot(slotId);
    if (farmZones.length) {
      const box = document.createElement('div');
      box.className = 'ipDesc';
      box.style.marginTop = '6px';
      box.innerHTML = (LANG==='fr' ? '📍 Où farmer : ' : '📍 Where to farm: ') +
        farmZones.map(zi => `<button class="eqFarmZoneBtn" data-zi="${zi}">${tr(ZONES[zi].name)}</button>`).join(' ');
      pop.appendChild(box);
      box.querySelectorAll('.eqFarmZoneBtn').forEach(btn => {
        btn.onclick = ev => {
          ev.stopPropagation();
          const zi = parseInt(btn.dataset.zi, 10);
          if (atVelia || zi !== zoneIdx) travelTo(zi);
          hideItemPop();
        };
      });
    }
  }
  highlightFarmZones(farmZones);
  pop.style.display = 'block';
  const r = cell.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  pop.style.left = Math.min(r.right + 8, window.innerWidth - pr.width - 10) + 'px';
  pop.style.top = Math.min(r.top, window.innerHeight - pr.height - 10) + 'px';
}
function fillPdCol(colId, ids) {
  const col = $(colId);
  col.innerHTML = '';
  for (const id of ids) {
    const e = EQUIP[id];
    const div = document.createElement('div');
    div.className = 'pdSlot ' + (e ? 'filled' : 'empty');
    div.dataset.slot = id;
    div.title = SLOT_LABEL[id] + (e ? ' — ' + e.name + pdStatSuffix(e) : ' (vide)');
    div.innerHTML = pdSlotInnerHtml(id);
    // halo de couleur sur le stuff équipé (2026-07-06, demande explicite : "met un halo de
    // couleurs sur le stuff... aussi comme les pierre de crons") -- couleur du palier (grise/
    // blanche/verte/bleue) ou couleur propre à l'objet (bijoux), même esprit que le glow de
    // l'orbe de Pierre de Cron
    if (e && e.color) div.style.boxShadow = `0 0 8px 2px ${e.color}66`;
    else div.style.boxShadow = '';
    // cadre coloré sur les bijoux équipés (2026-07-09, demande explicite) — le halo ci-dessus
    // reste discret, le CADRE lui-même reprend désormais la couleur du palier du bijou
    div.style.borderColor = (e && e.color && JEWELRY_SLOTS.includes(id)) ? e.color : '';
    div.onclick = ev => { ev.stopPropagation(); hideItemTooltip(); showEquipSlotMenu(div, id); };
    div.ondblclick = ev => { ev.stopPropagation(); hideItemPop(); if (e) unequip(id); };
    const optBtn = div.querySelector('.pdOptBtn');
    if (optBtn) optBtn.onclick = ev => {
      ev.stopPropagation(); hideItemTooltip(); hideItemPop();
      optTarget = { loc:'equip', key:id }; renderOptimization();
      $('optCard').scrollIntoView({ behavior:'smooth', block:'center' });
    };
    // ✕ en bas-droite : déséquiper directement, en plus du double-clic déjà existant —
    // demande explicite du 2026-07-09
    const unequipBtn = div.querySelector('.pdUnequipBtn');
    if (unequipBtn) unequipBtn.onclick = ev => {
      ev.stopPropagation(); hideItemTooltip(); hideItemPop();
      unequip(id);
    };
    // ⬆️/📍 en coin : raccourci direct vers la zone (pas de popup intermédiaire) — demande
    // explicite du 2026-07-09. ⬆️ ne propose que des zones où un vrai palier supérieur existe
    // (upgradeZonesForEquippedSlot : sûres, différentes de la zone actuelle, jamais si la pièce
    // équipée est déjà du palier de la zone ou mieux) ; 📍 garde le fallback dangereux de
    // zonesForSlot en dernier recours.
    const goBtn = div.querySelector('.pdUpgradeBtn, .pdFarmBtn');
    if (goBtn) goBtn.onclick = ev => {
      ev.stopPropagation(); hideItemTooltip(); hideItemPop();
      const zones = e ? upgradeZonesForEquippedSlot(id, e) : zonesForSlot(id);
      if (zones.length) { const zi = zones[0]; if (atVelia || zi !== zoneIdx) travelTo(zi); }
    };
    col.appendChild(div);
  }
}
// mise à jour ciblée d'UNE seule case de la poupée d'équipement (icône/badge d'enchant),
// sans reconstruire les ~13 cases + leurs gestionnaires d'événements ni redessiner le
// canvas — utilisée après une tentative d'optimisation pour rester fluide même en
// enchaînant les clics rapidement (avant ce correctif, chaque clic reconstruisait tout)
function refreshEquipSlot(slotId) {
  const div = document.querySelector('.pdSlot[data-slot="'+slotId+'"]');
  if (!div) return;
  const e = EQUIP[slotId];
  div.className = 'pdSlot ' + (e ? 'filled' : 'empty');
  div.title = SLOT_LABEL[slotId] + (e ? ' — ' + e.name + pdStatSuffix(e) : ' (vide)');
  div.innerHTML = pdSlotInnerHtml(slotId);
  div.style.boxShadow = (e && e.color) ? `0 0 8px 2px ${e.color}66` : '';
  div.style.borderColor = (e && e.color && JEWELRY_SLOTS.includes(slotId)) ? e.color : '';
}

function drawPreviewChar() {
  const c = $('charPrev'), x = c.getContext('2d');
  x.clearRect(0,0,c.width,c.height);
  x.fillStyle = 'rgba(201,165,90,.12)';
  x.beginPath(); x.ellipse(60,184,38,9,0,0,7); x.fill();
  // on dessine la sorcière en gros en réutilisant witchBody mais sur ce contexte
  drawWitchOn(x, 60, 150, 2.5);
}

// version paramétrable de witchBody pour un contexte/échelle donnés — délègue maintenant à
// witchBodyOn (2026-07-08) pour partager EXACTEMENT le même rendu par palier que le personnage en
// combat (couleurs/cornes/cape/orbes selon le stuff équipé)
function drawWitchOn(x, cx, cy, sc) {
  x.save(); x.translate(cx,cy); x.scale(sc,sc);
  witchBodyOn(x, performance.now()/1000, false);
  x.restore();
}

// ---------- grille d'inventaire : scindée en catégories filtrables (même tableau 192 cases
// en interne — seul l'affichage est filtré, pour ne pas casser tous les index déjà utilisés
// par l'équipement/la vente/les tooltips) ----------
// 4 inventaires distincts : chaque objet va dans le sien selon son type (plus de "Tout").
//  - Normal : équipement + bijoux
//  - Optimisation : matériaux d'enchantement + composants de craft endgame
//  - Consommable : consommables (potions, etc.)
//  - RNG : coffres/box aléatoires (vide pour l'instant — du contenu viendra)
// "Normal" renommé "Équipements" et Compendium promu en onglet PRINCIPAL au même niveau
// qu'Inventaire/Assemblage (2026-07-14, demande explicite : "met compendium en grand avec
// inventaire et assemblage") -- ne fait plus partie de ces catégories, voir #invModeCompendiumPane
// libellés raccourcis le 2026-07-16 (demande explicite : "inventaire rename Equip. Opti. Conso.")
// pour laisser respirer la grille désormais à 6 colonnes (ajout de Cristal, voir juste en dessous) --
// "Trésors"/"RNG" déjà assez courts, inchangés.
const INV_CATEGORIES = [
  { id:'normal',      icon:'⚔️', label:{fr:'Equip.',en:'Gear'},    kinds:['gear','jackpot'] },
  { id:'opt',         icon:'✦',  label:{fr:'Opti.',en:'Enh.'}, kinds:['material','craft'] },
  // Cristal (2026-07-16, demande explicite : "ajoute crystal") -- verrouillée, en attente d'un futur
  // système de cristaux en jeu (même stade que l'onglet Cristal de la carte Équipement, voir
  // #equipCrystalPane) ; aucun objet de type 'crystal' n'existe encore, la catégorie reste vide
  { id:'crystal',     icon:'💎', label:{fr:'Cristal',en:'Crystal'}, kinds:['crystal'], locked:true },
  // Trésors remonté avant Consommable (2026-07-14, demande explicite : "met tresors avant conso")
  { id:'treasure',    icon:'🗺️', label:{fr:'Trésors',en:'Treasures'}, kinds:['treasure'] },
  { id:'consumable',  icon:'🧪', label:{fr:'Conso.',en:'Cons.'},   kinds:['consumable'], locked:true },
  { id:'rng',         icon:'🎲', label:{fr:'RNG',en:'RNG'},          kinds:['rngbox'], locked:true },
];
let invCategory = 'normal';
// cadenas en badge au-dessus, centré (2026-07-14, demande explicite : "avec les cadenas au dessus
// au milieu") -- même pattern que les onglets de région (#zoneTierTabs, voir styles.css), sur une
// grille à 5 colonnes strictes pour que les 5 catégories tiennent toujours sur une seule ligne.
function renderInvCatTabs() {
  const el = $('invCatTabs'); if (!el) return;
  el.innerHTML = INV_CATEGORIES.map(c => `<button class="catTab${c.id===invCategory?' active':''}${c.locked?' locked':''}"` +
    `${c.locked?' disabled title="'+(LANG==='fr'?'Bientôt disponible':'Coming soon')+'"':''} data-cat="${c.id}">` +
    `${c.locked?'<span class="zoneTierLock">🔒</span>':''}<span class="zoneTierLabel">${c.icon} ${c.label[LANG]}</span></button>`).join('');
  el.querySelectorAll('.catTab:not(.locked)').forEach(btn => {
    btn.onclick = () => {
      invCategory = btn.dataset.cat;
      el.querySelectorAll('.catTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderInventory();
    };
  });
}

// badge de niveau d'enchantement pour une case de sac — même logique que pdSlotInnerHtmlFor (poupée
// d'équipement), réutilisée ici pour le sac principal ET le sac protégé du Compendium (2026-07-09,
// demande explicite : "on peut voir l'optimisation dans l'inventaire ET le compendium")
function cellEnhBadgeHtml(s) {
  if (!s.optimizable) return '';
  const lvl = s.enhLv || 0;
  return `<span class="cellEnh${lvl>=PRI_IDX?' pri':''}">${enhShortLabel(lvl)}</span>`;
}

let hoverInvIndex = -1;
let lastMouseX = 0, lastMouseY = 0;
function renderInventory() {
  const grid = $('invGrid');
  grid.innerHTML = '';
  renderTreasureCraftPanel();
  const cat = INV_CATEGORIES.find(c => c.id === invCategory) || INV_CATEGORIES[0];
  for (let i = 0; i < INV_SIZE; i++) {
    const s = INV[i];
    const cell = document.createElement('div');
    // en vue filtrée (pas "Tout"), les cases vides ET les objets d'une autre catégorie sont
    // masqués — sinon un onglet avec 3 objets ressemblerait à 189 cases vides pour rien
    const visible = cat.kinds === null || (s && cat.kinds.includes(s.kind));
    cell.className = 'cell' + (s ? ' has k-'+s.kind : '') + (visible ? '' : ' catHidden');
    if (s) {
      const cellApDp = (s.kind === 'gear' || s.kind === 'jackpot') ? effectiveApDp(s) : null;
      // les icônes SVG (équipement, matériaux) ont leurs couleurs FIGÉES dans le tracé — le style
      // "color" posé sur le <span> n'a donc aucun effet sur elles (une SVG ignore le color CSS du
      // parent sauf si elle utilise currentColor). Résultat : tout le stuff gris/blanc/vert/bleu se
      // ressemblait dans le sac. Corrigé en teintant la BORDURE de la case avec la vraie couleur du
      // palier/matériau — demande explicite du 2026-07-07. Étendu aux bijoux (jackpot) le 2026-07-09
      // (demande explicite) — même halo que sur la poupée d'équipement (voir JEWELRY_SLOTS), les
      // bijoux du sac restaient les seuls objets équipables sans indice visuel de palier.
      if (s.color && (s.kind === 'gear' || s.kind === 'material' || s.kind === 'jackpot')) {
        cell.style.borderColor = s.color;
        cell.style.boxShadow = `inset 0 0 6px ${s.color}55`;
      }
      // filet de sécurité (2026-07-08, demande explicite : "verifier que toutes les items
      // équipable ont un svg associé") : repli sur l'icône générique du slot si jamais un objet
      // (sauvegarde ancienne/corrompue) n'a pas de champ icon — évite une case vide/"undefined"
      const cellIcon = s.icon || (s.slot && SLOT_ICON[s.slot]) || '❔';
      cell.innerHTML = `<span style="color:${s.color}">${cellIcon}</span>` +
        cellEnhBadgeHtml(s) +
        (s.qty > 1 ? `<span class="qty">${fmt(s.qty)}</span>` : '') +
        (s.equipped ? `<span class="eqd">E</span>` : '') +
        (cellApDp && cellApDp.ap ? `<span class="cellAp">${cellApDp.ap}</span>` : '') +
        (cellApDp && cellApDp.dp ? `<span class="cellDp">${cellApDp.dp}</span>` : '');
      cell.onmouseenter = ev => { hoverInvIndex = i; lastMouseX = ev.clientX; lastMouseY = ev.clientY; showItemTooltip(ev.clientX, ev.clientY, { invIndex:i, ...s }); };
      cell.onmousemove  = ev => { lastMouseX = ev.clientX; lastMouseY = ev.clientY; moveItemTooltip(ev.clientX, ev.clientY); };
      cell.onmouseleave = () => { if (hoverInvIndex === i) hoverInvIndex = -1; hideItemTooltip(); };
      cell.onclick = ev => { ev.stopPropagation(); hideItemTooltip(); showItemMenuAtCell(cell, { invIndex:i, ...s }); };
      cell.ondblclick = ev => { ev.stopPropagation(); hideItemTooltip(); quickAction(i); };
      cell.oncontextmenu = ev => { ev.preventDefault(); ev.stopPropagation(); hideItemTooltip(); showItemMenu(ev.clientX, ev.clientY, { invIndex:i, ...s }); };
    } else {
      // case vide : clic = guide de farm (2026-07-05, demande explicite) -- où aller farmer,
      // hors zones trop dangereuses pour le stuff actuel
      cell.onclick = ev => { ev.stopPropagation(); showFarmGuide(); };
    }
    grid.appendChild(cell);
  }
  // message quand la catégorie active ne contient encore aucun objet (ex: RNG, Consommable)
  const anyVisible = INV.some(s => s && cat.kinds.includes(s.kind));
  if (!anyVisible) {
    const empty = document.createElement('div');
    empty.className = 'invCatEmpty';
    empty.textContent = cat.id === 'rng'
      ? (LANG==='fr'?'Aucun coffre RNG pour l\'instant':'No RNG box yet')
      : (LANG==='fr'?'Vide':'Empty');
    grid.appendChild(empty);
  }
  // la grille vient d'être reconstruite : le DOM survolé a été détruit sans mouseleave —
  // on rafraîchit le tooltip avec l'état actuel (ou on le ferme si la case est vide/hors zone)
  if (hoverInvIndex !== -1) {
    const s = INV[hoverInvIndex];
    if (s) showItemTooltip(lastMouseX, lastMouseY, { invIndex:hoverInvIndex, ...s });
    else { hoverInvIndex = -1; hideItemTooltip(); }
  }
  // pied
  const used = invUsed();
  $('slotTxtH').textContent = used+'/'+INV_SIZE;
  // le malus de vitesse lié au poids est retiré (2026-07-15, demande explicite : "enleve ralentit
  // par le poids") -- la barre de poids reste affichée à titre indicatif, mais "— ralenti !"
  // n'apparaît plus (voir speedMult() : ne dépend plus du tout du poids)
  const w = invWeight(), mw = MAX_WEIGHT(), overW = w > mw;
  $('wBar').style.width = Math.min(100, w/mw*100)+'%';
  $('wBar').classList.toggle('over', overW);
  $('wTxt').textContent = w.toFixed(1)+' / '+mw+' LT';
  $('wTxt').classList.toggle('bad', overW);
  $('invSilver').textContent = fmt(S.silver);
  $('invLoyalty').textContent = '🏅 '+fmt(S.loyalty||0);
}

// onglet Compendium PRINCIPAL, au même niveau qu'Inventaire/Assemblage (2026-07-14, demande
// explicite : "met compendium en grand avec inventaire et assemblage") -- avant, c'était une
// catégorie parmi d'autres DANS l'onglet Inventaire ; extrait ici en pane dédiée, grille séparée
// (#compGrid), même logique de case (icône, badge d'enchantement, PA/PD, bouton "équiper et
// optimiser") que l'ancienne intégration.
function renderCompendiumPane() {
  const grid = $('compGrid'); if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < INV_SIZE; i++) {
    const s = COMPENDIUM_BAG[i];
    const cell = document.createElement('div');
    cell.className = 'cell' + (s ? ' has k-'+s.kind : '');
    if (s) {
      const cellApDp = effectiveApDp(s);
      const cellIcon = s.icon || (s.slot && SLOT_ICON[s.slot]) || '❔';
      cell.innerHTML = `<span style="color:${s.color}">${cellIcon}</span>` +
        cellEnhBadgeHtml(s) +
        (cellApDp && cellApDp.ap ? `<span class="cellAp">${cellApDp.ap}</span>` : '') +
        (cellApDp && cellApDp.dp ? `<span class="cellDp">${cellApDp.dp}</span>` : '') +
        `<span class="compOptBtn" title="${LANG==='fr'?'Équiper et optimiser':'Equip and optimize'}">✦</span>`;
      if (s.color) { cell.style.borderColor = s.color; cell.style.boxShadow = `inset 0 0 6px ${s.color}55`; }
      cell.onmouseenter = ev => { lastMouseX = ev.clientX; lastMouseY = ev.clientY; showItemTooltip(ev.clientX, ev.clientY, s); };
      cell.onmousemove  = ev => { lastMouseX = ev.clientX; lastMouseY = ev.clientY; moveItemTooltip(ev.clientX, ev.clientY); };
      cell.onmouseleave = () => hideItemTooltip();
      // clic = ouvre le même menu popup que le reste du sac (2026-07-15, demande explicite :
      // "ajoute le bouton d'opti pour le compendium") -- avant, un clic déclenchait
      // equipFromCompendium() en silence ; désormais un bouton "Mettre en optimisation" explicite,
      // cohérent avec showItemMenu() pour tous les autres objets
      cell.onclick = ev => { ev.stopPropagation(); hideItemTooltip(); showItemMenuAtCell(cell, { compIndex:i, ...s }); };
    }
    grid.appendChild(cell);
  }
  const empty = $('compGridEmpty');
  if (empty) empty.style.display = COMPENDIUM_BAG.some(Boolean) ? 'none' : '';
}

// ---------- coffre de ville (2026-07-16, demande explicite) ----------
// premier emplacement UTILISABLE libre (les 172 au-delà de VELIA_CHEST_OPEN restent verrouillés,
// jamais candidats) — même esprit que invAdd() pour le sac principal, mais borné aux 20 cases ouvertes
function veliaChestFreeSlot() {
  for (let i = 0; i < VELIA_CHEST_OPEN; i++) if (!VELIA_CHEST[i]) return i;
  return -1;
}
// déplace N unités d'un objet du sac principal vers le coffre — empile d'abord sur une case déjà
// identique si possible, sinon prend un emplacement libre ; ne retire du sac QUE si la place au
// coffre est confirmée (jamais de perte si le coffre est plein)
function veliaChestStore(invIndex, n) {
  const s = INV[invIndex]; if (!s) return false;
  const take = Math.min(n, s.qty || 1);
  if (s.stackable) {
    const slot = VELIA_CHEST.slice(0, VELIA_CHEST_OPEN).findIndex(c => c && c.key === s.key && c.qty < MAX_STACK);
    if (slot !== -1) { VELIA_CHEST[slot].qty += take; invRemoveAt(invIndex, take); refreshInvUI(); renderVeliaChest(); return true; }
  }
  const free = veliaChestFreeSlot();
  if (free === -1) return false;
  VELIA_CHEST[free] = { ...s, qty: take };
  invRemoveAt(invIndex, take);
  refreshInvUI(); renderVeliaChest();
  return true;
}
// bascule 5/8 cases par ligne (2026-07-18, "bouton qui agrandi le coffre 4 ou 8 par ligne", passé
// à 5/ligne le 2026-07-08, demande explicite : "Met 5 par ligne dans le coffre 5 ou 8") --
// préférence d'affichage pure, pas de persistance nécessaire (retombe sur la vue dense par défaut
// à chaque rechargement, comme les autres onglets/filtres du jeu)
let chestZoomed = false;
function updateChestZoomBtn() {
  const btn = $('btnChestZoom'); if (!btn) return;
  btn.textContent = chestZoomed
    ? (LANG==='fr' ? '🔎 Réduire (8/ligne)' : '🔎 Shrink (8/row)')
    : (LANG==='fr' ? '🔍 Agrandir (5/ligne)' : '🔍 Enlarge (5/row)');
}
function renderVeliaChest() {
  const grid = $('veliaChestGrid'); if (!grid) return;
  grid.classList.toggle('chestZoomed', chestZoomed);
  updateChestZoomBtn();
  grid.innerHTML = '';
  for (let i = 0; i < INV_SIZE; i++) {
    const locked = i >= VELIA_CHEST_OPEN;
    const s = VELIA_CHEST[i];
    const cell = document.createElement('div');
    cell.className = 'cell' + (s ? ' has k-'+s.kind : '') + (locked ? ' locked' : '');
    if (locked) {
      // cadenas au-dessus, centré, même convention que .zoneTierLock partout ailleurs (onglets de
      // région/inventaire) -- avant, un span portait un style figé en dur (fond/bordure retirés,
      // ancré dans le flux normal) qui rendait ce cadenas visuellement incohérent avec le reste
      cell.innerHTML = `<span class="zoneTierLock">🔒</span>`;
      cell.style.opacity = '.4'; cell.style.cursor = 'not-allowed';
    } else if (s) {
      cell.innerHTML = `<span style="color:${s.color}">${s.icon || '❔'}</span>` +
        (s.qty > 1 ? `<span class="qty">${fmt(s.qty)}</span>` : '') +
        `<button class="compBagReturnBtn" data-i="${i}" title="${LANG==='fr'?'Renvoyer au sac principal':'Send back to main bag'}">↩️</button>`;
      if (s.color) { cell.style.borderColor = s.color; cell.style.boxShadow = `inset 0 0 6px ${s.color}55`; }
      cell.onmouseenter = ev => { lastMouseX = ev.clientX; lastMouseY = ev.clientY; showItemTooltip(ev.clientX, ev.clientY, s); };
      cell.onmousemove  = ev => { lastMouseX = ev.clientX; lastMouseY = ev.clientY; moveItemTooltip(ev.clientX, ev.clientY); };
      cell.onmouseleave = () => hideItemTooltip();
    }
    grid.appendChild(cell);
  }
  grid.querySelectorAll('.compBagReturnBtn').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.i, 10);
      const it = VELIA_CHEST[i]; if (!it) return;
      if (invAdd({ ...it })) { VELIA_CHEST[i] = null; renderVeliaChest(); refreshInvUI(); }
      else floatTxt(P.x, P.y, 100, LANG==='fr'?'Sac principal plein':'Main bag full', { hurt:true });
    };
  });
  const used = VELIA_CHEST.filter(Boolean).length;
  const summary = $('veliaChestSummary');
  if (summary) summary.textContent = `${used} / ${VELIA_CHEST_OPEN}`;
}
// bascule Loot/Coffre en haut de la carte "Loot de cette zone" (2026-07-16, demande explicite)
// classe DÉDIÉE "lootPanelTab" (2026-07-16, bug corrigé) -- réutiliser .invModeTab entrait en
// collision avec le câblage global de game-supabase.js (".invModeTab" y est aussi utilisé pour
// Inventaire/Assemblage/Compendium, chargé APRÈS ce fichier -- son .onclick écrasait le nôtre sur
// CES MÊMES boutons, puisque data-mode y valait undefined pour les nôtres, rien ne basculait jamais)
document.querySelectorAll('#lootPanelTabs .lootPanelTab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#lootPanelTabs .lootPanelTab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const panel = btn.dataset.panel;
    $('lootPanelLootPane').style.display = panel === 'loot' ? '' : 'none';
    $('lootPanelChestPane').style.display = panel === 'chest' ? '' : 'none';
    if (panel === 'chest') renderVeliaChest();
    // "borne la taille de la fiche coffre a une taille standard par rapport au autre" (2026-07-08)
    // -- #veliaChestGrid n'est mesurable par syncFarmCardHeights() (core/game-core.js) que quand cet
    // onglet vient de devenir visible (sinon hauteur 0) -- recalculé à chaque bascule Loot/Coffre.
    if (typeof syncFarmCardHeights === 'function') syncFarmCardHeights();
  };
});
$('btnChestZoom').onclick = () => { chestZoomed = !chestZoomed; renderVeliaChest(); };

// double-clic = action rapide selon le type d'objet
function quickAction(i) {
  const s = INV[i]; if (!s) return;
  if (s.kind === 'jackpot' || s.kind === 'gear') equipItem(i);
  else if (s.kind === 'material') { forcedMatKey = s.key; refreshInvUI(); }
  else if (s.kind === 'trash') sellOne(i);
  refreshInvUI();
}

// stat de référence déjà équipée pour comparer un objet du sac (pour les paires anneaux/boucles,
// on compare à la pièce la plus faible des deux — celle qui serait remplacée en premier)
function equippedRefForItem(item) {
  if (item.kind === 'gear') return EQUIP[item.slot];
  if (item.kind === 'jackpot') {
    const accSlot = accSlotFor(item);
    if (accSlot === 'ring') return itemScore(EQUIP.ring1) <= itemScore(EQUIP.ring2) ? EQUIP.ring1 : EQUIP.ring2;
    if (accSlot === 'earring') return itemScore(EQUIP.earring1) <= itemScore(EQUIP.earring2) ? EQUIP.earring1 : EQUIP.earring2;
    return EQUIP[accSlot];
  }
  return null;
}
// texte de gain/perte de stats (PA/PD/PV) par rapport à ce qui est déjà équipé dans le slot —
// affiché dans le menu au clic gauche pour décider d'équiper sans avoir à comparer soi-même
function statDeltaHtml(item) {
  const ref = equippedRefForItem(item);
  const cur = effectiveApDp(item);
  const refStats = ref ? effectiveApDp(ref) : { ap:0, dp:0, hp:0, dodge:0 };
  const parts = [];
  const d = (label, a, b, dec) => {
    const delta = dec ? Math.round((a - b)*10)/10 : Math.round(a - b);
    if (!delta) return;
    parts.push(`<span class="${delta>0?'statGain':'statLoss'}">${delta>0?'+':''}${delta} ${label}</span>`);
  };
  d('PA', cur.ap, refStats.ap); d('PD', cur.dp, refStats.dp); d('PV', cur.hp, refStats.hp);
  d('% Esq.', cur.dodge, refStats.dodge, true);
  if (!parts.length) return '';
  return `<div class="ipDelta">${ref ? (LANG==='fr'?'vs équipé : ':'vs equipped: ') : (LANG==='fr'?'rien d\'équipé — ':'nothing equipped — ')}${parts.join(' ')}</div>`;
}
// version texte brut (sans HTML) du delta — utilisée dans les libellés de bouton (textContent)
function statDeltaShortText(item) {
  const ref = equippedRefForItem(item);
  const cur = effectiveApDp(item);
  const refStats = ref ? effectiveApDp(ref) : { ap:0, dp:0, hp:0, dodge:0 };
  const parts = [];
  const d = (label, a, b, dec) => { const v = dec ? Math.round((a-b)*10)/10 : Math.round(a-b); if (v) parts.push((v>0?'+':'')+v+' '+label); };
  d('PA', cur.ap, refStats.ap); d('PD', cur.dp, refStats.dp); d('PV', cur.hp, refStats.hp);
  d('% Esq.', cur.dodge, refStats.dodge, true);
  return parts.length ? ' (' + parts.join(' ') + ')' : '';
}

// ---------- popup d'objet + actions ----------
function showItemMenu(px, py, data) {
  const pop = $('itemPop');
  let html = `<div class="ipName ${data.kind||''}">${tr(data.name)}</div>`;
  const desc = [];
  if (data.kind === 'trash') desc.push('Butin de vente. Valeur unitaire ~'+fmt(data.val)+' silver.');
  if (data.kind === 'material') desc.push('Matériau d\'optimisation. Utilisé automatiquement par le cadre Optimisation.');
  if (data.kind === 'jackpot') { const {ap,dp} = effectiveApDp(data); desc.push('Accessoire — '+(ap?('+'+ap+' PA'):'')+(dp?(' +'+dp+' PD'):'')); }
  if (data.kind === 'gear') { const {ap,dp,hp,dodge} = effectiveApDp(data); desc.push((data.slot==='weapon'?'Arme':'Armure')+' — '+(ap?('+'+ap+' PA '):'')+(dp?('+'+dp+' PD '):'')+(hp?('+'+hp+' PV '):'')+(dodge?('+'+dodge+'% Esq.'):'')+(data.optimizable?' · optimisable':'')); }
  if (data.kind === 'craft') desc.push('Composant de craft endgame. À conserver.');
  if (data.equipped) desc.push('Actuellement équipé' + (data.optimizable ? ' — niveau ' + ENH_NAMES[data.enhLv||0] : '') + '.');
  if (data.qty > 1) desc.push('Quantité : '+data.qty);
  const delta = (!data.equipped && (data.kind === 'gear' || data.kind === 'jackpot')) ? statDeltaHtml(data) : '';
  pop.innerHTML = html + `<div class="ipDesc">${desc.join('<br>')}</div>` + delta;

  // actions (libellés bilingues)
  const L = LANG === 'fr'
    ? { unequip:'Déséquiper', equip:'Équiper', toOpt:'Mettre en optimisation', sell1:n=>'Vendre 1 ('+n+')', sellAll:n=>'Vendre tout ('+n+')', drop:'Jeter',
        confirmSell1:n=>'Vendre 1 objet pour '+n+' silver ?', confirmSellAll:n=>'Vendre tout le tas pour '+n+' silver ?' }
    : { unequip:'Unequip', equip:'Equip', toOpt:'Load into enhancement', sell1:n=>'Sell 1 ('+n+')', sellAll:n=>'Sell all ('+n+')', drop:'Drop',
        confirmSell1:n=>'Sell 1 item for '+n+' silver?', confirmSellAll:n=>'Sell the whole stack for '+n+' silver?' };
  if (data.equipped) {
    addPopBtn(pop, L.unequip, () => { unequip(data.slotId); });
    if (data.kind === 'gear' || data.kind === 'jackpot') addPopBtn(pop, L.toOpt, () => { optTarget = { loc:'equip', key:data.slotId }; });
  } else if (data.invIndex != null) {
    const s = INV[data.invIndex];
    if (s.kind === 'jackpot' || s.kind === 'gear') {
      addPopBtn(pop, L.equip, () => { equipItem(data.invIndex); });
      // (2026-07-17, demande explicite : "optimiser un objet d'inventaire... sans toucher a
      // l'equipement") -- ne PLUS équiper l'objet ici, juste le cibler là où il est (dans le sac)
      addPopBtn(pop, L.toOpt, () => { optTarget = { loc:'inv', key:data.invIndex }; });
    }
    if (s.kind === 'material') addPopBtn(pop, L.toOpt, () => { forcedMatKey = s.key; });
    if (s.kind === 'trash' || s.kind === 'material' || s.kind === 'gear' || s.kind === 'jackpot')
      addPopBtn(pop, L.sell1(fmt(s.val)), () => { if (confirm(L.confirmSell1(fmt(s.val)))) sellOne(data.invIndex); });
    if ((s.kind === 'trash' || s.kind === 'material') && s.qty > 1)
      addPopBtn(pop, L.sellAll(fmt(s.val*s.qty)), () => { if (confirm(L.confirmSellAll(fmt(s.val*s.qty)))) sellStack(data.invIndex); });
    // coffre de ville (2026-07-16, demande explicite) : range 1 unité dans le coffre (même
    // granularité que "Vendre 1"), désactivé si le coffre n'a plus de place libre
    addPopBtn(pop, LANG==='fr'?'📦 Ranger au coffre (1)':'📦 Store in chest (1)', () => {
      if (!veliaChestStore(data.invIndex, 1)) floatTxt(P.x, P.y, 100, LANG==='fr'?'Coffre plein':'Chest full', { hurt:true });
    });
    addPopBtn(pop, L.drop, () => { dropItem(data.invIndex); });
  } else if (data.compIndex != null) {
    // objet du Compendium (sac protégé) — "Équiper" (equipFromCompendium, inchangé) ET "Mettre en
    // optimisation" séparés (2026-07-17, demande explicite : "on peut optimiser les item du
    // compendium" SANS les équiper) -- avant, le seul bouton disponible équipait ET ciblait
    // l'optimisation en même temps ; désormais l'objet peut être enchanté EN PLACE dans le
    // Compendium, jusqu'à PEN (voir attemptEnhance, qui l'évacue vers le sac une fois PEN atteint).
    addPopBtn(pop, L.equip, () => { equipFromCompendium(data.compIndex); });
    addPopBtn(pop, L.toOpt, () => { optTarget = { loc:'compendium', key:data.compIndex }; });
  }
  pop.style.display = 'block';
  const r = pop.getBoundingClientRect();
  pop.style.left = Math.min(px, window.innerWidth - r.width - 10) + 'px';
  pop.style.top = Math.min(py, window.innerHeight - r.height - 10) + 'px';
}
// clic gauche sur une case du sac : ouvre le même menu, mais ANCRÉ à la case (juste en dessous)
// plutôt qu'au curseur — demande explicite "collé à la case"
function showItemMenuAtCell(cell, data) {
  const r = cell.getBoundingClientRect();
  showItemMenu(r.left, r.bottom + 4, data);
}
function addPopBtn(pop, label, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = e => { e.stopPropagation(); fn(); hideItemPop(); refreshInvUI(); };
  pop.appendChild(b);
}
// variante avec du HTML (icône + texte) au lieu d'un simple texte — utilisée pour les candidats
// d'équipement (icône de l'objet + gain/perte de stats), demande explicite
function addPopBtnHtml(pop, html, fn) {
  const b = document.createElement('button');
  b.innerHTML = html;
  b.onclick = e => { e.stopPropagation(); fn(); hideItemPop(); refreshInvUI(); };
  pop.appendChild(b);
}
function hideItemPop() { $('itemPop').style.display = 'none'; document.querySelectorAll('#zoneList .zRow').forEach(r => r.classList.remove('eqFarmHalo')); }
document.addEventListener('click', () => { hideItemPop(); const ps = $('potSelect'); if (ps) ps.classList.remove('show'); });
document.addEventListener('contextmenu', ev => { if (!ev.target.closest('.cell')) hideItemPop(); });

// ---------- infobulle au survol (lecture seule) ----------
function itemTooltipHtml(data) {
  const desc = [];
  if (data.kind === 'trash') desc.push('Vente ~'+fmt(data.val)+' silver');
  if (data.kind === 'material') desc.push('Matériau d\'optimisation');
  if (data.kind === 'jackpot') { const {ap,dp} = effectiveApDp(data); desc.push('Accessoire'+(ap?(' · +'+ap+' PA'):'')+(dp?(' · +'+dp+' PD'):'')); }
  if (data.kind === 'gear') { const {ap,dp,hp,dodge} = effectiveApDp(data); desc.push((data.slot==='weapon'?'Arme':'Armure')+(ap?(' · +'+ap+' PA'):'')+(dp?(' · +'+dp+' PD'):'')+(hp?(' · +'+hp+' PV'):'')+(dodge?(' · +'+dodge+'% Esq.'):'')); }
  if ((data.kind === 'gear' || data.kind === 'jackpot') && data.optimizable && data.enhLv) desc.push('enchant '+ENH_NAMES[data.enhLv]);
  if (data.kind === 'craft') desc.push('Composant de craft endgame');
  if (data.qty > 1) desc.push('Quantité : '+data.qty);
  return `<div class="ipName ${data.kind||''}">${tr(data.name)}</div><div class="ipDesc">${desc.join(' · ')}</div>`;
}
function showItemTooltip(px, py, data) {
  const tip = $('itemTooltip');
  tip.innerHTML = itemTooltipHtml(data);
  tip.style.display = 'block';
  moveItemTooltip(px, py);
}
function moveItemTooltip(px, py) {
  const tip = $('itemTooltip');
  if (tip.style.display !== 'block') return;
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(px+14, window.innerWidth - r.width - 10) + 'px';
  tip.style.top = Math.min(py+14, window.innerHeight - r.height - 10) + 'px';
}
function hideItemTooltip() { $('itemTooltip').style.display = 'none'; }

// ---------- actions ----------
// détermine dans quel slot précis une pièce (arme/armure/accessoire) doit s'équiper
function resolveEquipSlot(item) {
  if (item.kind === 'gear') return item.slot; // 'weapon' | 'helmet' | 'armor' | 'gloves' | 'boots' — correspondance directe
  if (item.kind === 'jackpot') {
    return item.slot === 'ring' ? (EQUIP.ring1 ? (EQUIP.ring2 ? 'ring1' : 'ring2') : 'ring1')
         : item.slot === 'earring' ? (EQUIP.earring1 ? (EQUIP.earring2 ? 'earring1' : 'earring2') : 'earring1')
         : item.slot === 'necklace' ? 'necklace' : item.slot === 'belt' ? 'belt' : 'ring1';
  }
  return null;
}
// équipe automatiquement l'objet à l'index i S'IL EST MEILLEUR que ce qui est déjà équipé sur son
// slot (2026-07-10, demande explicite : "lorsque je vends un item ... s'il est meilleur je
// l'équipe" -- utilisé par sellOne AVANT toute vente, quelle que soit la provenance de l'objet).
// Pour un anneau/boucle (paire), compare au PIRE des deux déjà équipés (celui qui serait remplacé
// en premier, même logique que refScoreForSlot) et l'équipe SPÉCIFIQUEMENT à cette place — jamais
// via resolveEquipSlot seul, qui ne regarde pas lequel des deux est le plus faible.
// compare 2 pièces avec la MÊME règle partout (2026-07-11, demande explicite : "si 2 stuff
// identique doivent etre changé toujours prendre celui le plus optimisé... sans oublier les 2
// anneaux verification slot 1 puis slot 2 et oreille slot 1 puis slot 2") : meilleur SOCLE
// (itemScore) d'abord ; à socle STRICTEMENT égal, le plus enchanté (enhLv) l'emporte ; à égalité
// totale, "a" (slot 1) reste la référence -- même critère que equipBestSingle/equipBestPair, pour
// que sellOne (via tryAutoEquipIfBetter) ne rate plus jamais un doublon plus enchanté juste parce
// que son socle de base est identique.
function isStrictlyBetterGear(a, b) {
  const sa = itemScore(a), sb = itemScore(b);
  if (sa !== sb) return sa > sb;
  return (a ? (a.enhLv||0) : -1) > (b ? (b.enhLv||0) : -1);
}
function tryAutoEquipIfBetter(i, s) {
  if (s.kind !== 'gear' && s.kind !== 'jackpot') return false;
  // gear : s.slot EST le slot direct ('helmet','weapon'...) ; jackpot : s.slot est déjà la BASE
  // ('ring'/'earring'/'necklace'/'belt'), voir accSlotFor -- pas besoin de resolveEquipSlot ici
  const base = s.slot;
  if (base === 'ring' || base === 'earring') {
    const slotA = base+'1', slotB = base+'2';
    // "slot 1 puis slot 2" : à égalité totale entre les 2 anneaux/boucles déjà équipés, slotA
    // (slot 1) reste la référence "pire" par défaut -- slotB n'est le pire QUE si slotA est
    // strictement meilleur que lui, sinon (slotB meilleur OU égalité) slotA est vérifié en premier
    const worseSlot = isStrictlyBetterGear(EQUIP[slotA], EQUIP[slotB]) ? slotB : slotA;
    if (!isStrictlyBetterGear(s, EQUIP[worseSlot])) return false;
    const old = EQUIP[worseSlot];
    if (old && !invAdd({ ...old, equipped:false, qty:1, stackable:false })) return false; // sac plein
    EQUIP[worseSlot] = { ...s };
    INV[i] = null;
    return true;
  }
  if (!isStrictlyBetterGear(s, EQUIP[base])) return false;
  equipItem(i);
  return true;
}
// équipe n'importe quelle pièce (arme/armure/accessoire) dans le bon slot
function equipItem(i) {
  const item = INV[i]; if (!item) return;
  const slotId = resolveEquipSlot(item);
  if (!slotId) return;
  // renvoie l'ancienne pièce dans le sac
  if (EQUIP[slotId]) {
    const old = EQUIP[slotId];
    if (!invAdd({ ...old, equipped:false, qty:1, stackable:false })) return; // sac plein, on annule
  }
  EQUIP[slotId] = { ...item };
  INV[i] = null;
  hud();
}
// équivalent de equipItem(i) mais pour un objet du sac protégé (Compendium) -- demande explicite
// du 2026-07-14 : "possibilité d'optimisation direct avec un bouton" depuis l'onglet Compendium.
// L'ancienne pièce équipée revient dans le sac PRINCIPAL (INV), pas dans le Compendium -- seul le
// meilleur exemplaire de chaque nom est censé y résider (voir ensureCompendiumProtection).
function equipFromCompendium(i) {
  const item = COMPENDIUM_BAG[i]; if (!item) return;
  const slotId = resolveEquipSlot(item);
  if (!slotId) return;
  if (EQUIP[slotId]) {
    const old = EQUIP[slotId];
    if (!invAdd({ ...old, equipped:false, qty:1, stackable:false })) return; // sac plein, on annule
  }
  EQUIP[slotId] = { ...item };
  COMPENDIUM_BAG[i] = null;
  optTarget = { loc:'equip', key:slotId };
  hud();
  renderCompendiumPane();
  renderOptimization();
}
function unequip(slotId) {
  const e = EQUIP[slotId]; if (!e) return;
  if (invAdd({ ...e, equipped:false, qty:1, stackable:false })) { EQUIP[slotId] = null; hud(); }
}

// ---------- "Équiper le meilleur" : comparaison sur les stats DE BASE uniquement ----------
// (volontairement SANS le bonus d'enchantement : un objet +0 avec un meilleur socle vaut mieux
//  à terme qu'un objet déjà monté mais avec un socle plus faible — c'est lui qu'il faut remonter)
// dodge (2026-07-08) : poids ×3 pour compter comme un vrai critère secondaire sans dominer PA/PD
function itemScore(it) { return it ? (it.ap||0) + (it.dp||0)*0.5 + (it.dodge||0)*3 : -1; }

function equipBestSingle(slotId, kind) {
  const current = EQUIP[slotId];
  let best = null, bestIdx = -1;
  let bestScore = itemScore(current), bestEnh = current ? (current.enhLv||0) : -1;
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i];
    if (!it || it.kind !== kind) continue;
    const itSlot = kind === 'gear' ? it.slot : accSlotFor(it);
    if (itSlot !== slotId) continue;
    const sc = itemScore(it);
    const enh = it.enhLv || 0;
    // meilleur SOCLE d'abord ; à socle ÉGAL, le plus haut déjà enchanté l'emporte (2026-07-09,
    // demande explicite : "si les 2 base sont identique alors ce sera le plus haut deja monté") --
    // ne remplace jamais un objet déjà enchanté par un jumeau au même socle mais moins monté
    if (sc > bestScore || (sc === bestScore && enh > bestEnh)) { bestScore = sc; bestEnh = enh; best = it; bestIdx = i; }
  }
  if (!best) return false;
  if (current && !invAdd({ ...current, equipped:false, qty:1, stackable:false })) return false; // sac plein
  EQUIP[slotId] = { ...best };
  INV[bestIdx] = null;
  return true;
}
function equipBestPair(slotA, slotB, accSlot) {
  const candidates = [];
  if (EQUIP[slotA]) candidates.push(EQUIP[slotA]);
  if (EQUIP[slotB]) candidates.push(EQUIP[slotB]);
  const invIdxOf = new Map();
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i];
    if (it && it.kind === 'jackpot' && accSlotFor(it) === accSlot) { candidates.push(it); invIdxOf.set(it, i); }
  }
  // même règle que equipBestSingle (2026-07-09, demande explicite) : meilleur socle d'abord, et à
  // socle égal le plus haut déjà enchanté l'emporte
  candidates.sort((a,b) => (itemScore(b) - itemScore(a)) || ((b.enhLv||0) - (a.enhLv||0)));
  const chosen = candidates.slice(0, 2);
  const before = [EQUIP[slotA], EQUIP[slotB]].filter(Boolean);
  const changed = before.length !== chosen.length || before.some(it => !chosen.includes(it));
  if (!changed) return false;
  const toReturn = before.filter(it => !chosen.includes(it));
  for (const it of chosen) { const idx = invIdxOf.get(it); if (idx !== undefined) INV[idx] = null; }
  for (const it of toReturn) invAdd({ ...it, equipped:false, qty:1, stackable:false });
  EQUIP[slotA] = chosen[0] ? { ...chosen[0] } : null;
  EQUIP[slotB] = chosen[1] ? { ...chosen[1] } : null;
  return true;
}
function equipBestGear() {
  let changed = 0;
  for (const slotId of ['weapon','awakening','secondary','helmet','armor','gloves','boots'])
    if (equipBestSingle(slotId, 'gear')) changed++;
  for (const slotId of ['necklace','belt'])
    if (equipBestSingle(slotId, 'jackpot')) changed++;
  if (equipBestPair('ring1','ring2','ring')) changed++;
  if (equipBestPair('earring1','earring2','earring')) changed++;
  hud();
  return changed;
}
$('btnEquipBest').onclick = () => {
  const n = equipBestGear();
  const msg = $('equipBestMsg');
  if (msg) {
    msg.textContent = n > 0
      ? (LANG==='fr' ? `${n} pièce${n>1?'s':''} remplacée${n>1?'s':''} (meilleur socle)` : `${n} piece${n>1?'s':''} swapped (better base stats)`)
      : (LANG==='fr' ? 'Déjà optimal — rien à changer' : 'Already optimal — nothing to change');
    msg.className = n > 0 ? 'ok' : '';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};

// ---------- vente automatique : tout objet strictement moins bon (socle) que ce qui est déjà équipé ----------
function refScoreForSlot(slotId, accSlot) {
  if (accSlot === 'ring') return Math.min(itemScore(EQUIP.ring1), itemScore(EQUIP.ring2));
  if (accSlot === 'earring') return Math.min(itemScore(EQUIP.earring1), itemScore(EQUIP.earring2));
  return itemScore(EQUIP[slotId]);
}
// met en évidence "⚡ Équiper meilleur" (2026-07-09, demande explicite) : au moins un objet du sac
// est resté SANS être équipé plus de 15s (voir pickedAt dans invAdd) tout en étant réellement
// meilleur (itemScore) que ce qui est actuellement équipé sur son socle -- signale un oubli plutôt
// qu'un objet tout juste looté qu'on n'a pas encore eu le temps de comparer
const NEGLECTED_UPGRADE_DELAY_MS = 15000;
function hasNeglectedUpgradeInBag() {
  const now = Date.now();
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i]; if (!it) continue;
    if (it.kind !== 'gear' && it.kind !== 'jackpot') continue;
    if (now - (it.pickedAt || 0) < NEGLECTED_UPGRADE_DELAY_MS) continue;
    const slotId = it.kind === 'gear' ? it.slot : accSlotFor(it);
    const accSlot = it.kind === 'jackpot' ? accSlotFor(it) : null;
    const ref = refScoreForSlot(slotId, accSlot);
    if (itemScore(it) > ref) return true;
  }
  return false;
}
// dernière vente "Vendre l'inférieur" (snapshot des objets vendus) — sert au bouton "↩️ Racheter"
// pour annuler un clic accidentel, demande explicite du 2026-07-06 ; annulable une seule fois,
// non persisté (perdu au rechargement, ce n'est qu'un filet de sécurité immédiat)
let lastWorseSaleSold = null;
function sellWorseThanEquipped() {
  let count = 0, total = 0, divertedCount = 0;
  const sold = [];
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i]; if (!it) continue;
    if (it.kind !== 'gear' && it.kind !== 'jackpot') continue;
    const slotId = it.kind === 'gear' ? it.slot : accSlotFor(it);
    const accSlot = it.kind === 'jackpot' ? accSlotFor(it) : null;
    const ref = refScoreForSlot(slotId, accSlot);
    if (ref < 0) continue; // rien d'équipé pour comparer → on ne touche pas (pourrait être la 1ère pièce du slot)
    if (itemScore(it) <= ref) {
      // sac "Compendium" (2026-07-08, demande explicite) : le PREMIER exemplaire d'un type jamais
      // monté en PEN est protégé dans ce sac dédié au lieu d'être vendu — les suivants du même type
      // (déjà un exemplaire en sécurité) continuent d'être vendus normalement
      if (!S.penMastery[it.name] && !compendiumBagHasName(it.name) && compendiumBagAdd(it)) {
        divertedCount++; INV[i] = null; count++;
      } else {
        total += it.val * it.qty; sold.push({ ...it }); INV[i] = null; count++;
      }
    }
  }
  if (count > 0) { addSilver(total, 'sell', 'Vendre l\'inférieur'); lastWorseSaleSold = sold; hud(); }
  return { count, total, divertedCount };
}
// annule la dernière "Vendre l'inférieur" : reverse le silver gagné et restaure les objets vendus
// (tout ou rien — n'annule rien si le sac n'a pas assez de place ou si le silver a depuis baissé
// sous le montant à rendre)
function buyBackLastWorseSale() {
  if (!lastWorseSaleSold || !lastWorseSaleSold.length) return false;
  const total = lastWorseSaleSold.reduce((a,it) => a + it.val*it.qty, 0);
  const freeSlots = INV.filter(s => s === null).length;
  if (freeSlots < lastWorseSaleSold.length || S.silver < total) return false;
  // annule une vente : contrairement à une dépense normale (voir addSilver), ceci retire du
  // silverEarned aussi (le gain précédent est complètement défait, pas juste dépensé)
  S.silver -= total; S.silverEarned -= total;
  if (typeof queueSilverLedger === 'function') queueSilverLedger(-total, 'undo_sell', 'Racheter');
  lastWorseSaleSold.forEach(it => invAdd({ ...it }));
  lastWorseSaleSold = null;
  hud();
  return true;
}
$('btnSellWorse').onclick = () => {
  const { count, total, divertedCount } = sellWorseThanEquipped();
  // "Racheter" ne peut annuler que les objets réellement VENDUS (silver) — pas ceux protégés dans
  // le sac Compendium, qui n'ont jamais quitté ta possession et sont récupérables depuis là-bas
  $('btnBuyBackWorse').disabled = !lastWorseSaleSold || !lastWorseSaleSold.length;
  const msg = $('equipBestMsg');
  if (msg) {
    const soldCount = count - divertedCount;
    const divertedTxt = divertedCount > 0
      ? (LANG==='fr' ? ` · +${divertedCount} protégé${divertedCount>1?'s':''} dans le sac 📖 Compendium` : ` · +${divertedCount} protected in the 📖 Compendium bag`)
      : '';
    msg.textContent = count > 0
      ? (LANG==='fr' ? `${soldCount} objet${soldCount>1?'s':''} vendu${soldCount>1?'s':''} (+${fmt(total)} silver)${divertedTxt}` : `${soldCount} item${soldCount>1?'s':''} sold (+${fmt(total)} silver)${divertedTxt}`)
      : (LANG==='fr' ? 'Rien à vendre — tout est déjà au-dessus de l\'équipé' : 'Nothing to sell — everything already beats what\'s equipped');
    msg.className = count > 0 ? 'ok' : '';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};
$('btnBuyBackWorse').onclick = () => {
  const ok = buyBackLastWorseSale();
  $('btnBuyBackWorse').disabled = true;
  const msg = $('equipBestMsg');
  if (msg) {
    msg.textContent = ok
      ? (LANG==='fr' ? 'Objets rachetés ✓' : 'Items bought back ✓')
      : (LANG==='fr' ? 'Rien à racheter (ou sac plein / silver insuffisant)' : 'Nothing to buy back (or bag full / not enough silver)');
    msg.className = ok ? 'ok' : '';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};

function enhanceWithMaterial(i) {
  // conservé pour compat (non utilisé par le popup désormais, cf. cadre Optimisation)
  const mat = INV[i]; if (!mat || !EQUIP.weapon || EQUIP.weapon.enhLv >= ENH_NAMES.length-1) return;
  invRemoveAt(i, 1);
  const lvl = EQUIP.weapon.enhLv, target = EQUIP.weapon;
  const chance = enhChance(lvl+1, target);
  const success = Math.random() < chance;
  if (success) {
    target.enhLv++;
    floatTxt(P.x,P.y,100,'✦ '+ENH_NAMES[target.enhLv],{gold:true});
  } else {
    addItemFailstack(target, lvl+1);
    if (lvl >= SAFE_IDX && lvl < PRI_IDX) { // +8 à +15 : peut rétrograder, jamais sous +7
      target.enhLv = Math.max(SAFE_IDX-1, lvl-1);
      floatTxt(P.x,P.y,100,'✖ rétrogradé — '+ENH_NAMES[target.enhLv],{hurt:true});
    } else if (lvl >= PRI_IDX) { // PRI et plus : rétrograde d'un palier à chaque échec, mais jamais sous PRI (pas de retour à +15)
      target.enhLv = Math.max(PRI_IDX, lvl-1);
      floatTxt(P.x,P.y,100,'✖ rétrogradé — '+ENH_NAMES[target.enhLv],{hurt:true});
    } else floatTxt(P.x,P.y,100,'✖ échec',{hurt:true});
  }
  renderEquipment(); refreshStatsOnly(); renderOptimization();
}

// ---------- cadre d'optimisation (armes + armure + bijoux, cible sélectionnable, façon BDO) ----------
// cible généralisée (2026-07-17, demande explicite : "optimiser un objet d'inventaire... sans
// toucher a l'equipement... on peut optimiser les item du compendium") -- avant, l'optimisation ne
// pouvait cibler QUE l'équipement (EQUIP[optTargetSlot]), donc "optimiser" un objet du sac ou du
// Compendium devait d'abord l'ÉQUIPER (remplaçant ce qui était porté). Remplacé par une cible
// {loc,key} : 'equip' (key = slot EQUIP), 'inv' (key = index INV), 'compendium' (key = index
// COMPENDIUM_BAG) -- l'objet est enchanté EN PLACE, quel que soit l'endroit où il se trouve.
let optTarget = { loc:'equip', key:'weapon' };
function getOptTargetItem() {
  if (optTarget.loc === 'equip') return EQUIP[optTarget.key];
  if (optTarget.loc === 'inv') return INV[optTarget.key];
  if (optTarget.loc === 'compendium') return COMPENDIUM_BAG[optTarget.key];
  return null;
}
let forcedMatKey = null; // matériau épinglé via le menu clic droit ("Mettre en optimisation")

function optimizableList() { return OPTIMIZABLE_SLOTS.filter(k => EQUIP[k]); }
// chaque palier de stuff (Naru/Tuvala/Yuria/Grunil) a SA PROPRE pierre d'optimisation, jamais
// interchangeable avec celle d'un autre palier (2026-07-11, demande explicite : "on doit pas
// avoir un stuff tuvala qui s'opti avec une pierre de naru") -- avant, si le bon matériau
// n'était pas en stock, un repli silencieux consommait N'IMPORTE QUEL AUTRE matériau (y compris
// celui d'un palier différent) ; supprimé, sans le bon matériau l'optimisation reste bloquée.
function findEnhanceMaterial() {
  const target = getOptTargetItem();
  const wantedName = (target && target.matName) || Z().loot.mat.name;
  if (forcedMatKey) {
    const idx = INV.findIndex(s => s && s.key === forcedMatKey);
    // le matériau épinglé (clic droit "Mettre en optimisation") doit AUSSI correspondre au
    // palier de la pièce actuellement ciblée -- sinon il est ignoré, jamais utilisé de force
    if (idx !== -1 && INV[idx].name === wantedName) return idx;
    forcedMatKey = null; // épuisé ou ne correspond plus à la pièce ciblée -> repli automatique
  }
  return INV.findIndex(s => s && s.kind === 'material' && s.name === wantedName);
}
function findCronStone() { return INV.findIndex(s => s && s.name === CRON_STONE.name); }
function renderOptimization() {
  // (re)construit la liste déroulante des pièces optimisables équipées (armes + armure + bijoux)
  const avail = optimizableList();
  // ne réinitialise sur le 1er équipement QUE si la cible actuelle ne pointe plus vers rien de
  // valide (objet retiré/vendu/évacué ailleurs) -- une cible sac/Compendium (2026-07-17) reste
  // volontairement HORS de "avail" (qui ne liste que l'équipement), donc ne doit jamais être
  // écrasée simplement parce qu'elle n'y figure pas
  if (!getOptTargetItem()) optTarget = { loc:'equip', key: avail[0] || 'weapon' };
  const sel = $('optTarget');
  sel.innerHTML = avail.map(k => `<option value="${k}" ${(optTarget.loc==='equip'&&k===optTarget.key)?'selected':''}>${SLOT_LABEL[k]} — ${tr(EQUIP[k].name)} (${ENH_NAMES[EQUIP[k].enhLv||0]})</option>`).join('');

  const target = getOptTargetItem();
  const lvl = target ? (target.enhLv||0) : 0, maxed = lvl >= ENH_NAMES.length-1;
  const parts = target && !maxed ? enhChanceParts(lvl+1, target) : { base:0, bonus:0, total:0 };
  const fsCount = target ? itemFailstack(target, lvl+1) : 0;
  $('optItem').innerHTML = target ? (target.icon || (optTarget.loc==='equip' ? SLOT_ICON[optTarget.key] : '❔')) : '—';
  $('optItem').style.boxShadow = (target && target.color) ? `0 0 8px 2px ${target.color}66` : '';
  $('optLevelLbl').innerHTML = (target ? tr(target.name) : (LANG==='fr'?'Aucune pièce équipée':'No piece equipped')) + ' <b id="optLevelVal">' + (target ? ENH_NAMES[lvl] : '—') + '</b>';

  const matIdx = findEnhanceMaterial(), matSlotEl = $('optMat');
  const maxedTxt = LANG==='fr' ? 'PEN atteint — niveau maximum' : 'PEN reached — max level';
  if (!target) { matSlotEl.className='empty'; matSlotEl.innerHTML='＋'; matSlotEl.style.boxShadow=''; $('optChanceTxt').textContent = LANG==='fr'?'Équipez une pièce à optimiser':'Equip a piece to enhance'; $('btnOpt').disabled=true; }
  else if (matIdx === -1) {
    matSlotEl.className = 'empty'; matSlotEl.innerHTML = '＋'; matSlotEl.title = ''; matSlotEl.style.boxShadow = '';
    $('optChanceTxt').textContent = maxed ? maxedTxt : (LANG==='fr'?'Aucun matériau en sac — farmez du loot':'No material in bag — go loot some');
    $('btnOpt').disabled = true;
  } else {
    const it = INV[matIdx];
    matSlotEl.className = ''; matSlotEl.title = it.name;
    matSlotEl.innerHTML = `<span style="color:${it.color}">${it.icon}</span>` + (it.qty>1?`<span class="matQty">${fmt(it.qty)}</span>`:'');
    matSlotEl.style.boxShadow = it.color ? `0 0 8px 2px ${it.color}66` : '';
    $('btnOpt').disabled = maxed;
    const fsTxt = fsCount > 0 ? ` <span style="color:#8fc9e8">(+${fsCount} ${LANG==='fr'?'échecs sur ce palier':'fails on this tier'})</span>` : '';
    $('optChanceTxt').innerHTML = maxed ? maxedTxt
      : `${LANG==='fr'?'Matériau':'Material'} : ${tr(it.name)} · ${LANG==='fr'?'Chance':'Chance'} : ${(parts.total*100).toFixed(1)}% → ${ENH_NAMES[lvl+1]}${fsTxt}`;
  }
  // barre à deux tons : chance de base (or) + bonus du failstack accumulé sur CE palier (bleu)
  $('optChanceFill').style.width = (parts.base*100)+'%';
  $('optChanceFillFS').style.width = (parts.bonus*100)+'%';
  // Pierre de Cron : case à part, à droite du matériau — au choix du joueur, la case elle-même
  // sert de bouton on/off (2026-07-08, demande explicite : remplace l'ancienne case à cocher
  // séparée). L'icône réelle (orbe turquoise, voir ICO_CRON_STONE) remplace le placeholder ⏳
  // statique qui ne changeait jamais -- affichée en permanence, grisée si désactivée ou vide.
  const cronIdx = findCronStone(), cronSlotEl = $('optCronSlot');
  $('optCronIcon').innerHTML = CRON_STONE.icon;
  const cronOffCls = S.useCronStone ? '' : ' off';
  // coût variable selon le palier de la pièce CIBLÉE (2026-07-15, demande explicite : "affiche ce
  // que tu utilise/besoin selon le stuff équipé dans l'opti") -- affiché "as-tu / il-faut", ex.
  // "5 / 3" (5 en stock, 3 nécessaires pour CETTE pièce), en rouge si pas assez en stock
  const cronCost = cronStoneCostForItem(target);
  const cronHave = cronIdx === -1 ? 0 : INV[cronIdx].qty;
  if (cronIdx === -1) {
    cronSlotEl.className = 'empty' + cronOffCls; cronSlotEl.title = LANG==='fr'?'Aucune Pierre de Cron en sac':'No Cron Stone in bag';
    $('optCronQty').textContent = target ? `0/${cronCost}` : '';
    cronSlotEl.style.boxShadow = '';
  } else {
    cronSlotEl.className = cronOffCls.trim(); cronSlotEl.title = CRON_STONE.name + ' — ' +
      (S.useCronStone ? (LANG==='fr'?'utilisée (clique pour désactiver)':'in use (click to disable)')
                      : (LANG==='fr'?'non utilisée (clique pour activer)':'not used (click to enable)')) +
      (target ? (LANG==='fr'?` · coût pour cette pièce : ${cronCost}`:` · cost for this piece: ${cronCost}`) : '');
    $('optCronQty').innerHTML = target
      ? `<span class="${cronHave >= cronCost ? '' : 'bad'}">${fmt(cronHave)}/${cronCost}</span>`
      : fmt(cronHave);
    cronSlotEl.style.boxShadow = S.useCronStone ? `0 0 8px 2px ${CRON_STONE.color}66` : '';
  }
  renderOptSuggestions();
  if (!autoOptTimer) renderOptAutoTargetSelect(); // pas touché pendant une auto en cours (garde le palier choisi)
  renderCapConvertRow();
}
$('optTarget').onchange = e => { optTarget = { loc:'equip', key:e.target.value }; stopAutoOpt(); renderOptimization(); };
// la case Pierre de Cron sert elle-même de bouton on/off (2026-07-08, demande explicite),
// remplace l'ancienne case à cocher #optCronToggle
$('optCronSlot').onclick = () => { S.useCronStone = !S.useCronStone; renderOptimization(); };

// une tentative d'optimisation (succès/échec/rétrogradation) — factorisée pour être appelée
// aussi bien par le bouton manuel que par la boucle "Auto jusqu'à" (voir plus bas)
function attemptEnhance() {
  const target = getOptTargetItem();
  const idx = findEnhanceMaterial();
  if (!target || idx === -1 || (target.enhLv||0) >= ENH_NAMES.length-1) return false;
  invRemoveAt(idx, 1);
  S.enhAttempts = (S.enhAttempts||0) + 1;
  const lvl = target.enhLv||0;
  const chance = enhChance(lvl+1, target);
  const r = $('optResult');
  if (Math.random() < chance) {
    target.enhLv = lvl+1;
    S.enhSuccess = (S.enhSuccess||0) + 1;
    // le failstack déjà acquis sur les AUTRES paliers reste acquis (rien n'est effacé) — seul le
    // palier qu'on vient de passer n'a plus besoin d'être suivi, il reste stocké mais inutilisé
    r.textContent = (LANG==='fr'?'✦ SUCCÈS — ':'✦ SUCCESS — ') + ENH_NAMES[target.enhLv]; r.className = 'ok';
    floatTxt(P.x,P.y,100,'✦ '+ENH_NAMES[target.enhLv],{gold:true});
    // Compendium : trace le meilleur niveau jamais atteint pour ce nom (2026-07-15), survit à une
    // vente ultérieure -- avant, seul le passage à PEN précis était retenu (S.penMastery)
    trackEnhPeak(target.name, target.enhLv);
    // Compendium PEN (2026-07-08) : marque CE type d'objet comme "atteint PEN au moins 1 fois"
    if (target.enhLv >= ENH_NAMES.length-1) {
      markPenMastery(target.name);
      // Compendium : ne garde que du TET (IV) maximum (2026-07-17, demande explicite : "une fois
      // PEN il disparaissent du compendium... uniquement des item TET maximum"), généralisé le
      // 2026-07-08 (demande explicite : "un item qui passe pen... supprime l'item non pen du sac
      // protégé compendium") -- avant, seul le cas où l'objet OPTIMISÉ était lui-même la copie
      // protégée était géré (optTarget.loc==='compendium') ; désormais couvre aussi le cas où
      // c'est un exemplaire ÉQUIPÉ ou du sac principal qui atteint PEN alors qu'une AUTRE copie
      // (non-PEN) du même nom est protégée dans le Compendium en attendant -- cette copie n'a
      // plus de raison d'y rester, voir evictMasteredFromCompendiumBag (core/game-core.js).
      evictMasteredFromCompendiumBag(target.name);
    }
  } else {
    addItemFailstack(target, lvl+1); // le failstack de CE palier, pour CET objet, progresse et reste acquis
    // Pierre de Cron : au choix du joueur (case à cocher #optCronToggle, S.useCronStone — demande
    // explicite du 2026-07-06, remplace l'ancienne consommation 100% automatique et silencieuse),
    // UNIQUEMENT quand cet échec aurait fait rétrograder l'objet — protège le palier actuel, le
    // matériau d'optimisation reste perdu comme sur n'importe quel échec
    const wouldDowngrade = lvl >= SAFE_IDX;
    // coût variable selon le palier de LA PIÈCE PROTÉGÉE (2026-07-15, demande explicite : "pierre
    // de cron utilisation gris 1 blanc 2 vert 3 bleu 4") -- avant, toujours 1 pierre quel que soit
    // le palier ; il faut désormais assez de pierres en stock pour couvrir le coût du palier
    const cronCost = cronStoneCostForItem(target);
    const cronIdxRaw = (wouldDowngrade && S.useCronStone) ? findCronStone() : -1;
    const cronIdx = (cronIdxRaw !== -1 && INV[cronIdxRaw].qty >= cronCost) ? cronIdxRaw : -1;
    if (cronIdx !== -1) {
      invRemoveAt(cronIdx, cronCost);
      // journalise la CONSOMMATION de Pierres de Cron (2026-07-19, demande explicite : "je veux
      // utilisation des cron ... comme les silver me le dire") -- jusqu'ici seul le ramassage
      // (farm_events, kind='material') était tracké côté serveur ; la consommation (invRemoveAt
      // ci-dessus) ne touchait QUE l'inventaire local, invisible pour l'admin. Réutilise le même
      // queueFarmEvent()/farm_events déjà en place pour le ramassage (pas de nouvelle table), avec
      // un kind DISTINCT ('cron_used') pour ne jamais se mélanger aux ramassages dans
      // admin_farm_by_item (qui groupe par item_name ET item_kind).
      if (typeof queueFarmEvent === 'function') queueFarmEvent('cron_used', CRON_STONE.name, cronCost, 0);
      r.textContent = (LANG==='fr'?'✖ ÉCHEC — protégé par '+cronCost+' Pierre'+(cronCost>1?'s':'')+' de Cron (':'✖ FAIL — protected by '+cronCost+' Cron Stone'+(cronCost>1?'s':'')+' (')+ENH_NAMES[target.enhLv]+')';
      floatTxt(P.x,P.y,100,LANG==='fr'?'⏳ Protégé !':'⏳ Protected!',{blue:true});
    } else if (lvl >= SAFE_IDX && lvl < PRI_IDX) { // +8 à +15 : peut rétrograder, jamais sous +7
      target.enhLv = Math.max(SAFE_IDX-1, lvl-1);
      r.textContent = (LANG==='fr'?'✖ ÉCHEC — rétrogradé à ':'✖ FAIL — downgraded to ') + ENH_NAMES[target.enhLv];
    } else if (lvl >= PRI_IDX) { // PRI et plus : rétrograde d'un palier, mais jamais sous PRI (pas de retour à +15)
      target.enhLv = Math.max(PRI_IDX, lvl-1);
      r.textContent = (LANG==='fr'?'✖ ÉCHEC — rétrogradé à ':'✖ FAIL — downgraded to ') + ENH_NAMES[target.enhLv];
    } else {
      r.textContent = LANG==='fr' ? '✖ ÉCHEC — matériau perdu' : '✖ FAIL — material lost';
    }
    r.className = 'fail';
    // redémarre l'animation sans lecture forcée de layout (offsetWidth) — un simple retrait/ajout
    // de classe suffit puisque le navigateur applique déjà les deux changements sur des frames
    // séparées ; l'ancienne version forçait un reflow synchrone à CHAQUE tentative, ce qui devenait
    // sensible en enchaînant les clics rapidement
    const card = $('optCard'); card.classList.remove('optShake');
    requestAnimationFrame(() => card.classList.add('optShake'));
  }
  // mise à jour ciblée (voir refreshEquipSlot) au lieu de tout reconstruire (poupée + canvas) à
  // chaque tentative — gardait le jeu fluide même en spammant le bouton d'optimisation. Une cible
  // sac/Compendium (2026-07-17) n'a pas de case dédiée à rafraîchir en place -- retombe sur un
  // rendu complet de la grille concernée (même coût que le reste de refreshInvUI, déjà accepté).
  if (optTarget.loc === 'equip') {
    refreshEquipSlot(optTarget.key);
    if (optTarget.key === 'weapon') drawPreviewChar(); // seule la lueur du bâton en dépend visuellement
  } else if (optTarget.loc === 'inv') {
    renderInventory();
  } else if (optTarget.loc === 'compendium') {
    renderCompendiumPane();
  }
  $('stWeaponBonus').textContent = '+' + Math.round(enhBonus(EQUIP.weapon ? EQUIP.weapon.enhLv : 0) * 100) + '%';
  $('stArmorBonus').textContent = '+' + Math.round(armorBonusAvg() * 100) + '%';
  refreshStatsOnly(); renderOptimization();
  return true;
}
$('btnOpt').onclick = attemptEnhance;

// ---------- optimisation automatique jusqu'à un palier choisi ----------
// tente automatiquement (toutes les ~200 ms, pour rester visible) jusqu'à atteindre le palier
// choisi OU tomber à court de matériau — s'arrête aussi si l'objet redescend sous le palier visé
// à cause d'une rétrogradation (pour ne pas vider tout le sac dans un mur de malchance)
// calcule le gain de stats (PA/PD/PV/Esquive) entre l'état actuel de la pièce et un palier visé —
// réutilisé à la fois pour chaque option du menu déroulant et le résumé sous celui-ci
function optAutoGainParts(target, targetLvl) {
  if (!target || !Number.isInteger(targetLvl)) return [];
  const cur = effectiveApDp(target), proj = projectedApDp(target, targetLvl);
  const parts = [];
  if (proj.ap > cur.ap) parts.push('+' + (proj.ap-cur.ap) + ' PA');
  if (proj.dp > cur.dp) parts.push('+' + (proj.dp-cur.dp) + ' PD');
  if (proj.hp > cur.hp) parts.push('+' + (proj.hp-cur.hp) + ' PV');
  if (proj.dodge > cur.dodge) parts.push('+' + (proj.dodge-cur.dodge).toFixed(2) + '% ' + (LANG==='fr'?'Esq.':'Dodge'));
  return parts;
}
// version compacte du gain, un SEUL stat (le principal de la pièce : PA pour arme/éveil/dague, PD
// pour casque/armure/gants/bottes) — demande explicite du 2026-07-09 : "revois les info que tu
// donne lorsqu'il y a plusieurs stats" -- le menu déroulant cumulait PD+PV+Esquive sur une seule
// ligne par palier (voir capture jointe), illisible. Le détail complet (tous les stats) reste
// disponible juste en dessous du menu, voir renderOptAutoGain/optAutoGainParts.
// bug corrigé le 2026-07-12 (demande explicite : "l'anneau de yuria ne fournit pas les bonus +1
// +2 dans la liste lors de l'opti automatique") -- ne testait que WEAPON_SLOTS (PA) vs "tout le
// reste" (PD) par défaut, oubliant que les BIJOUX (JEWELRY_SLOTS) donnent de la PA eux aussi
// (GEAR_ROLE.jackpot : apShare:0.10, dpShare:0) — pour un anneau/collier/boucle/ceinture, le code
// regardait donc le delta de PD (toujours 0 sur un bijou), jamais celui de PA, et n'affichait donc
// jamais de gain dans la liste déroulante, quel que soit le palier visé.
// primary dérivé directement de l'objet ciblé (2026-07-17 : plus de slotId disponible pour une
// cible sac/Compendium) plutôt que du slot EQUIP -- gear : arme (WEAPON_SLOTS) -> PA, sinon PD ;
// jackpot (bijou) -> toujours PA, quel que soit l'endroit où l'objet se trouve
function targetPrimaryStat(target) {
  if (!target) return 'dp';
  if (target.kind === 'jackpot') return 'ap';
  return WEAPON_SLOTS.includes(target.slot) ? 'ap' : 'dp';
}
function optAutoGainPrimaryPart(target, targetLvl) {
  if (!target || !Number.isInteger(targetLvl)) return '';
  const cur = effectiveApDp(target), proj = projectedApDp(target, targetLvl);
  const primary = targetPrimaryStat(target);
  const delta = proj[primary] - cur[primary];
  return delta > 0 ? '+' + delta + ' ' + (primary === 'ap' ? 'PA' : 'PD') : '';
}
function renderOptAutoTargetSelect() {
  const sel = $('optAutoTarget'); if (!sel) return;
  const prevVal = sel.value; // préserve le choix du joueur à travers les re-renders (voir plus bas)
  const target = getOptTargetItem();
  const curLvl = target ? (target.enhLv||0) : 0;
  const options = ENH_NAMES.map((name,i) => i).filter(i => i > curLvl);
  // affiche le gain directement dans chaque option du menu déroulant (demande explicite du
  // 2026-07-05), pas seulement pour le palier actuellement sélectionné -- n'affiche le gain QUE
  // sur le palier où il change RÉELLEMENT (2026-07-08, demande explicite : "n'affiche +1 que
  // lorsque tu gagne 1AP, le suivant sera +2") : avec l'arrondi vers le bas (voir effectiveApDp),
  // plusieurs paliers consécutifs peuvent cumuler le même gain entier tant que la fraction
  // accumulée n'a pas franchi le point suivant -- répéter "(+1 PA)" sur 7 paliers d'affilée
  // donnait l'impression d'un gain figé/buggé ; on ne le réaffiche donc qu'au moment où il change.
  let lastGainTxt = null;
  sel.innerHTML = options.map(i => {
    const gainTxt = optAutoGainPrimaryPart(target, i);
    const showGain = gainTxt !== lastGainTxt;
    if (gainTxt) lastGainTxt = gainTxt;
    return `<option value="${i}">${ENH_NAMES[i]}${(showGain && gainTxt) ? ' (' + gainTxt + ')' : ''}</option>`;
  }).join('') || `<option value="">${LANG==='fr'?'Niveau max atteint':'Max level reached'}</option>`;
  sel.disabled = !options.length;
  // restaure le palier précédemment choisi par le joueur, s'il est toujours une option valide
  // (2026-07-16, bug corrigé : "je choisis qqch dans la liste pour opti auto et ça le choisit pas,
  // revient sur le choix d'avant") -- avant, reconstruire innerHTML remettait TOUJOURS le <select>
  // sur sa 1ère option ; comme renderOptimization() (donc cette fonction) est redéclenché par
  // n'importe quel événement de fond (loot ramassé, équipement changé...), le choix du joueur
  // pouvait être silencieusement écrasé quelques instants après l'avoir fait
  if (options.some(i => String(i) === prevVal)) sel.value = prevVal;
  renderOptAutoGain();
}
// affiche le gain de stats si on atteint le palier choisi dans #optAutoTarget (ex: "+18 PA")
function renderOptAutoGain() {
  const el = $('optAutoGainTxt'); if (!el) return;
  const target = getOptTargetItem();
  const sel = $('optAutoTarget');
  const targetLvl = sel ? parseInt(sel.value, 10) : NaN;
  const parts = optAutoGainParts(target, targetLvl);
  el.textContent = parts.length
    ? (LANG==='fr' ? `À ${ENH_NAMES[targetLvl]} : ` : `At ${ENH_NAMES[targetLvl]}: `) + parts.join(' · ')
    : '';
}
$('optAutoTarget').onchange = renderOptAutoGain;
// mode de l'auto-optimisation en cours ('target'/'loop'/'fail'/'cron') — voir startAutoOpt
let autoOptMode = 'target';
function stopAutoOpt() {
  if (autoOptTimer) { clearInterval(autoOptTimer); autoOptTimer = null; }
  autoOptTargetLvl = null;
  const btn = $('btnOptAuto'); if (!btn) return;
  btn.classList.remove('running');
  btn.textContent = LANG==='fr' ? "▶ Auto jusqu'à" : '▶ Auto to';
  $('optAutoTarget').disabled = false;
  $('optAutoMode').disabled = false;
}
// bascule l'affichage du sélecteur de palier : uniquement utile en mode 'target' (2026-07-08)
$('optAutoMode').onchange = () => {
  $('optAutoTarget').style.display = $('optAutoMode').value === 'target' ? '' : 'none';
};
function startAutoOpt() {
  if (autoOptTimer) { clearInterval(autoOptTimer); autoOptTimer = null; } // garde-fou : jamais 2 intervalles en parallèle
  const mode = $('optAutoMode').value;
  autoOptMode = mode;
  autoOptTargetLvl = null;
  if (mode === 'target') {
    const sel = $('optAutoTarget');
    const lvl = parseInt(sel.value, 10);
    if (!Number.isInteger(lvl)) return;
    autoOptTargetLvl = lvl;
    sel.disabled = true;
  }
  // "jusqu'au prochain gain de PA/PD" (2026-07-08, demande explicite) : capture le PA/PD ACTUEL
  // (entier, arrondi vers le bas — voir effectiveApDp) avant de démarrer, puis s'arrête dès que ce
  // chiffre affiché augmente réellement — utile après le fix du menu déroulant (2026-07-08) qui a
  // montré que plusieurs paliers d'affilée ne changent parfois rien tant que la fraction accumulée
  // n'a pas franchi le point suivant
  let startAp = 0, startDp = 0;
  if (mode === 'nextgain') {
    const target0 = getOptTargetItem();
    if (!target0) return;
    const cur = effectiveApDp(target0);
    startAp = cur.ap; startDp = cur.dp;
  }
  $('optAutoMode').disabled = true;
  const btn = $('btnOptAuto');
  btn.classList.add('running');
  btn.textContent = LANG==='fr' ? '⏸ Arrêter' : '⏸ Stop';
  autoOptTimer = setInterval(() => {
    const target = getOptTargetItem();
    if (!target) { stopAutoOpt(); return; }
    if (mode === 'target' && (target.enhLv||0) >= autoOptTargetLvl) { stopAutoOpt(); return; }
    if ((target.enhLv||0) >= ENH_NAMES.length-1) { stopAutoOpt(); return; } // niveau max déjà atteint
    if (findEnhanceMaterial() === -1) {
      $('optResult').textContent = LANG==='fr' ? 'Auto arrêté — plus de matériau' : 'Auto stopped — out of material';
      stopAutoOpt();
      return;
    }
    // "jusqu'à plus de Pierre de Cron" (2026-07-08, demande explicite) : s'arrête dès que le sac
    // n'a plus de quoi protéger la prochaine rétrogradation — utile pour pousser un palier risqué
    // (+8 et au-delà) sans jamais tenter "à découvert" une fois le stock de protection épuisé
    if (mode === 'cron' && findCronStone() === -1) {
      $('optResult').textContent = LANG==='fr' ? 'Auto arrêté — plus de Pierre de Cron' : 'Auto stopped — out of Cron Stones';
      stopAutoOpt();
      return;
    }
    const prevLvl = target.enhLv||0;
    attemptEnhance();
    // "jusqu'au premier échec" (2026-07-08, demande explicite) : un échec est détecté quand le
    // niveau n'a PAS progressé d'exactement +1 (protection Cron incluse : le niveau ne bouge pas
    // non plus dans ce cas, donc compte comme un échec qui arrête la boucle)
    if (mode === 'fail') {
      const target2 = getOptTargetItem();
      if (!target2 || (target2.enhLv||0) !== prevLvl + 1) { stopAutoOpt(); return; }
    }
    // "jusqu'au prochain gain de PA/PD" : s'arrête dès que le PA OU le PD affiché a réellement
    // augmenté par rapport au début de l'auto (voir startAp/startDp ci-dessus)
    if (mode === 'nextgain') {
      const target3 = getOptTargetItem();
      if (!target3) { stopAutoOpt(); return; }
      const cur = effectiveApDp(target3);
      if (cur.ap > startAp || cur.dp > startDp) {
        $('optResult').textContent = LANG==='fr' ? `Auto arrêté — gain obtenu (${ENH_NAMES[target3.enhLv||0]})` : `Auto stopped — gain reached (${ENH_NAMES[target3.enhLv||0]})`;
        stopAutoOpt();
        return;
      }
    }
    // "en boucle" (2026-07-08, demande explicite) : aucune condition d'arrêt sur le niveau, continue
    // jusqu'à rupture de matériau (déjà géré ci-dessus) ou arrêt manuel
  }, 220);
}
$('btnOptAuto').onclick = () => { if (autoOptTimer) stopAutoOpt(); else startAutoOpt(); };

// ---------- conversion "Poussière d'esprit ancien" → "Pierre de Caphras" (5:1) ----------
// demande explicite du 2026-07-05 : la Pierre de Caphras n'est plus dropée directement en zone
// (remplacée par le matériau de palier Naru/Tuvala/Yuria/Grunil), elle s'obtient désormais via
// cette conversion de la poussière ramassée en zones 1 à 6.
const POUSSIERE_NAME = 'Poussière d\'esprit ancien';
const CAPHRAS_NAME = 'Pierre de Caphras';
function poussiereCount() {
  const s = INV.find(x => x && x.kind === 'craft' && x.name === POUSSIERE_NAME);
  return s ? s.qty : 0;
}
function renderCapConvertRow() {
  const lbl = $('capConvertLbl'), btn = $('btnConvertCaphras'); if (!lbl || !btn) return;
  const n = poussiereCount();
  lbl.textContent = (LANG==='fr' ? `${fmt(n)} poussière → ${Math.floor(n/5)} pierre de Caphras` : `${fmt(n)} dust → ${Math.floor(n/5)} Caphras stone`);
  btn.disabled = n < 5;
}
function convertPoussiereToCaphras() {
  const idx = INV.findIndex(s => s && s.kind === 'craft' && s.name === POUSSIERE_NAME);
  if (idx === -1 || INV[idx].qty < 5) return;
  INV[idx].qty -= 5;
  if (INV[idx].qty <= 0) INV[idx] = null;
  const ok = invAdd({ key:'mat_'+CAPHRAS_NAME, name:CAPHRAS_NAME, kind:'material', icon:ICO_MAT_CAPHRAS, color:'#c9a55a', qty:1, stackable:true, weight:0.1, val:120 });
  if (!ok) {
    // sac plein : annule le prélèvement de poussière
    const s = INV[idx];
    if (s) s.qty += 5; else INV[idx] = { key:'craft_'+POUSSIERE_NAME, name:POUSSIERE_NAME, kind:'craft', icon:'✦', color:'#b48ce8', qty:5, stackable:true, weight:0.2, val:0 };
    floatTxt(P.x, P.y, 100, LANG==='fr'?'Sac plein':'Bag full', { hurt:true });
    return;
  }
  floatTxt(P.x, P.y, 100, '+1 '+CAPHRAS_NAME, { gold:true });
  hud();
}
$('btnConvertCaphras').onclick = convertPoussiereToCaphras;

// suggestion : quelle pièce optimiser en priorité pour atteindre la zone suivante -- réduite au
// minimum d'info le 2026-07-15 (demande explicite : "affiche les idée de stuff... avec le moins
// d'info possible avec écris au dessus recommandé:") -- avant, une phrase complète avec le déficit
// PA/PD et le gain estimé ; désormais juste un label "Recommandé :" suivi du nom de la pièce et de
// son palier d'enchantement cible, sans justification ni chiffres
function renderOptSuggestions() {
  const nextZone = ZONES[zoneIdx+1];
  const box = $('optSuggest');
  if (!nextZone) { box.innerHTML = ''; return; }
  const avail = optimizableList();
  if (!avail.length) { box.innerHTML = ''; return; }

  const apDeficit = Math.max(0, nextZone.reqAP - apEff());
  const dpDeficit = Math.max(0, nextZone.reqDP - totalDP());
  // le goulot le plus criant détermine ce qu'on recommande d'améliorer (PA ou PD)
  const focusAP = (apDeficit / nextZone.reqAP) >= (dpDeficit / nextZone.reqDP);

  let best = null, bestGain = -1;
  for (const k of avail) {
    const e = EQUIP[k];
    const lvl = e.enhLv||0;
    if (lvl >= ENH_NAMES.length-1) continue;
    const step = enhBonus(lvl+1) - enhBonus(lvl);
    // on note chaque pièce selon sa capacité à combler le manque prioritaire (PA ou PD)
    const gain = focusAP ? e.ap*step : (e.dp||0)*step;
    if (gain > bestGain) { bestGain = gain; best = { k, e, lvl }; }
  }
  if (!best || bestGain <= 0) { box.innerHTML = ''; return; }

  const arrow = ENH_NAMES[best.lvl] + '→' + ENH_NAMES[best.lvl+1];
  const lbl = LANG==='fr' ? 'Recommandé' : 'Recommended';
  box.innerHTML = `<div class="optSuggestLbl">${lbl} :</div><div class="optSuggestPick">${tr(best.e.name)} <span class="optSuggestArrow">${arrow}</span></div>`;
}

// ---------- table de loot de la zone active (ou en aperçu via le bouton "Voir"), avec % réels ----------
const LOOT_ICONS = { trash:'▬', material:'◈', jackpot:'💍', craft:'✦', gear:'⚔️' };
// bouton "vente auto" verrouillé, par item de la table de loot (2026-07-16, demande explicite :
// "ajoute un bouton bloqué cadenas vente auto sur chaque item dans la lootable") -- même convention
// que #btnAutoSellLoot (global, voir index.html) : cadenas TOUJOURS en badge au-dessus, centré
// (.zoneTierLock/.lockedFeatureBtn), jamais inline dans le bouton
function lootAutoSellLockHtml() {
  return `<button class="lootAutoSellBtn" disabled title="${LANG==='fr'?'Vente automatique (bientôt disponible)':'Auto-sell (coming soon)'}"><span class="zoneTierLock">🔒</span>🗑️</button>`;
}
// aperçu agrandi au survol d'une icône de la table de loot (2026-07-08, demande explicite : "qu'on
// puisse agrandir l'icone pour mieux la voir en tooltip en auto en passant dessus") -- écoute
// déléguée sur tout le document (les icônes sont recréées à chaque rendu de table de loot, sur
// plusieurs panneaux : zone active, récapitulatif Velia, guide de farm) plutôt qu'un binding par
// élément qu'il faudrait refaire à chaque re-render
(function initLootIconZoom() {
  const zoomEl = document.getElementById('lootIconZoom');
  if (!zoomEl) return;
  document.addEventListener('mouseover', e => {
    const icon = e.target.closest('.lootIcon');
    if (!icon) return;
    zoomEl.innerHTML = icon.innerHTML;
    const col = icon.style.color; if (col) zoomEl.style.color = col;
    const r = icon.getBoundingClientRect();
    let left = r.right + 10, top = r.top + r.height/2 - 48;
    if (left + 96 > window.innerWidth) left = r.left - 106;
    top = Math.max(6, Math.min(top, window.innerHeight - 102));
    zoomEl.style.left = left + 'px'; zoomEl.style.top = top + 'px';
    zoomEl.classList.add('show');
  });
  document.addEventListener('mouseout', e => {
    const icon = e.target.closest('.lootIcon');
    if (!icon) return;
    if (icon.contains(e.relatedTarget)) return;
    zoomEl.classList.remove('show');
  });
})();
// construit les lignes de loot d'UNE zone (utilisé pour l'aperçu normal ET pour le récapitulatif
// "toutes zones confondues" affiché à Velia, voir renderLootTable ci-dessous)
function zoneLootRowsHtml(idx) {
  const z = ZONES[idx], L = z.loot;
  const tier = gearTierForZone(idx);
  const gearCh = gearDropChance(tier, idx);
  const equippedWord = LANG === 'fr' ? 'PA équipé' : 'AP equipped';
  const armorPieceNote = LANG==='fr' ? 'armure — cette zone uniquement' : 'armor — this zone only';
  const weaponPieceNote = LANG==='fr' ? 'arme — cette zone uniquement' : 'weapon — this zone only';
  const rows = [
    { kind:'trash',    it:L.trash,   note:'revenu de base' },
    { kind:'material', it:{name:tier.material.name, icon:tier.material.icon}, ch:L.mat.ch, note:'optimisation' },
  ];
  // détaille EXACTEMENT quelle pièce d'armure (et quelle arme, s'il y en a une) cette zone précise
  // garantit (2026-07-06, demande explicite : "explique quel stuff exactement tu vas pouvoir
  // loot") — remplace l'ancienne ligne générique "Gris — Naru / arme+armure (7 pièces)", qui ne
  // disait pas laquelle des 7 pièces on obtenait réellement ici (voir ZONE_ARMOR_SLOTS/ZONE_WEAPON_SLOTS)
  // -- chaque ligne utilise désormais la VRAIE icône de la pièce (2026-07-08, demande explicite :
  // "as-tu mis les svg sur la loottable" — remplace le glyphe générique ⚔️/💍 partagé par tout un
  // "kind", qui ne montrait pas à quoi la pièce allait réellement ressembler)
  const GEAR_ICON_FOR_SLOT = { helmet:helmetIconForColor, armor:armorIconForColor, gloves:glovesIconForColor, boots:bootsIconForColor,
    weapon:staffIconForColor, secondary:daggerIconForColor, awakening:orbPairIconForColor };
  const armorSlot = (ZONE_ARMOR_SLOTS[idx]||[])[0];
  if (armorSlot) rows.push({ kind:'gear', it:{name:tier.sets[armorSlot], icon:GEAR_ICON_FOR_SLOT[armorSlot](tier.color,tier.grade)}, ch:gearCh, note:armorPieceNote, slot:armorSlot });
  const weaponSlot = (ZONE_WEAPON_SLOTS[idx]||[])[0];
  if (weaponSlot) rows.push({ kind:'gear', it:{name:tier.sets[weaponSlot], icon:GEAR_ICON_FOR_SLOT[weaponSlot](tier.color,tier.grade)}, ch:gearCh, note:weaponPieceNote, slot:weaponSlot });
  const jSlot = accSlotFor(L.jackpot);
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const jackpotIcon = (JEWEL_ICON_FOR_SLOT[jSlot] || ringIconForTier)(jTierIdx, tier.color);
  // AP affiché = celui RÉELLEMENT dropé (voir rollDrops), pas l'ancienne valeur figée de ZONES —
  // sinon la table de loot promettrait un chiffre différent de ce qu'on obtient vraiment en jeu
  const jackpotApShown = gearFloor((z.gearBasisAP ?? z.reqAP) * GEAR_ROLE.jackpot.apShare);
  rows.push(
    { kind:'jackpot',  it:{...L.jackpot, ch:jewelDropChance(tier, L.jackpot.ch), icon:jackpotIcon}, note:'+'+jackpotApShown+' '+equippedWord, baseSlot:jSlot },
    { kind:'craft',    it:L.craft,   note:'craft endgame' },
    // Pierre de Cron : taux fixe (voir CRON_STONE.ch), identique dans TOUTES les zones — demande explicite du 2026-07-08
    { kind:'material', it:{name:CRON_STONE.name, icon:CRON_STONE.icon}, ch:CRON_STONE.ch, note:'1 à 3 unités — protège un enchantement d\'une rétrogradation' },
  );
  // flèche ⬆️ dans la table de loot (2026-07-16, demande explicite : "pour la flèche qui te montre
  // la zone du stuff qui t'upgrade, une fois sur la zone la fleche se met dans la loottable") --
  // avant, l'indicateur ⬆️ restait uniquement sur la poupée d'équipement (.pdUpgradeBtn) et la
  // ligne de la liste de zones (.zUpgradeIcon), pointant VERS la zone à atteindre ; une fois qu'on y
  // est vraiment (idx === zoneIdx), pointer vers une zone où on se trouve déjà n'a plus de sens —
  // l'indicateur se déplace donc sur la ligne de loot CONCERNÉE, pour montrer précisément QUEL objet
  // ramasser ici. Ne s'affiche que sur la zone réellement farmée, jamais en aperçu (👁) ni à Velia.
  const upgradedSlots = (idx === zoneIdx && !atVelia) ? slotsUpgradedByZone(idx) : [];
  // les couleurs des rangées "armure" et "matériau" reprennent celles du stuff dans l'inventaire
  // (gris/blanc/vert/bleu selon le palier) au lieu d'un violet/or générique — demande du 2026-07-06.
  // "jackpot" (bijou) manquait à cette table (2026-07-10, bug trouvé en vérification) : la ligne
  // dépliée du bijou restait sans couleur alors que la ligne condensée (zoneLootCompactRowHtml),
  // l'inventaire (2026-07-09) et la poupée d'équipement (2026-07-05) l'ont toutes.
  const rowColor = { gear: tier.color, material: tier.material.color, jackpot: tier.color };
  // catégorisation (2026-07-14, demande explicite : "catégorise la table de loot, Trashloot avec
  // son prix, objet d'optimisation, stuff") -- 3 groupes : Trash (avec son prix silver), objets
  // d'optimisation (matériaux + composants de craft), stuff (armure/arme/bijou).
  // "Stuff" renommé "Équipements" et remonté au-dessus des objets d'optimisation (2026-07-14,
  // demande explicite : "modifie stuff en equipements" / "met le stuff au dessus d'objet dopti")
  const LOOT_CATS = {
    trash:    { fr:'Trashloot', en:'Trash loot', order:0 },
    gear:     { fr:'Équipements', en:'Gear', order:1 },
    jackpot:  { fr:'Équipements', en:'Gear', order:1 },
    material: { fr:'Objets d\'optimisation', en:'Enhancement items', order:2 },
    craft:    { fr:'Objets d\'optimisation', en:'Enhancement items', order:2 },
  };
  const rowsHtml = rows.map(r => {
    const ch = r.ch ?? r.it.ch;
    // la Pierre de Cron garde SA couleur propre (dorée) plutôt que celle du matériau de palier —
    // sinon les 2 rangées "material" se confondraient visuellement
    const col = r.it.name === CRON_STONE.name ? CRON_STONE.color : rowColor[r.kind];
    const iconHtml = r.it.icon || LOOT_ICONS[r.kind];
    // prix affiché uniquement pour le trash (2026-07-14, demande explicite) -- seul objet dont la
    // valeur est fixe et connue à l'avance (gear/bijou dépendent de l'enchantement, non pertinent ici)
    const priceHtml = r.kind === 'trash' ? `<div class="lv">${fmt(r.it.val)} silver</div>` : '';
    // flèche d'upgrade (voir le commentaire sur upgradedSlots plus haut) : gear -> son slot exact,
    // jackpot -> n'importe quel slot de bijou de la même base (bague/collier/boucle/ceinture)
    const isUpgrade = r.slot ? upgradedSlots.includes(r.slot)
      : r.baseSlot ? upgradedSlots.some(s => accBaseSlot(s) === r.baseSlot) : false;
    const upgradeHtml = isUpgrade ? `<span class="lootUpgradeArrow" title="${LANG==='fr'?'Améliore ton stuff actuel':'Upgrades your current gear'}">⬆️</span>` : '';
    return { cat: LOOT_CATS[r.kind] || { fr:'Autre', en:'Other', order:9 }, html: `
    <div class="lootRow${isUpgrade?' lootRowUpgrade':''}">
      ${upgradeHtml}
      <div class="lootIcon k-${r.kind}"${col?` style="color:${col};border-color:${col}"`:''}>${iconHtml}</div>
      <div class="lootInfo"><div class="ln"${col?` style="color:${col}"`:''}>${tr(r.it.name)}</div><div class="lv">${tr(r.note)}</div>${priceHtml}</div>
      <div class="lootPct">${(ch*100).toFixed(ch < .01 ? 3 : 1)}%</div>
      ${lootAutoSellLockHtml()}
    </div>` };
  });
  const catOrder = [...new Set(rowsHtml.map(r => r.cat.order))].sort((a,b) => a-b);
  return catOrder.map(order => {
    const group = rowsHtml.filter(r => r.cat.order === order);
    const label = group[0].cat[LANG];
    return `<div class="lootCatHead">${label}</div>${group.map(r => r.html).join('')}`;
  }).join('');
}
// ligne CONDENSÉE (1 par zone, repliée par défaut) pour le récapitulatif "toutes zones" de Velia —
// demande explicite du 2026-07-08 ("faut scroll à la mort") : affiche juste le bijou (l'objet le
// plus recherché de la zone), un clic déplie le détail complet via zoneLootRowsHtml
function zoneLootCompactRowHtml(idx) {
  const z = ZONES[idx], tier = gearTierForZone(idx);
  // vraie icône du bijou de cette zone (2026-07-08, même correctif que zoneLootRowsHtml) au lieu
  // du glyphe générique 💍 partagé par tous les paliers
  const jSlot = accSlotFor(z.loot.jackpot);
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const jackpotIcon = (JEWEL_ICON_FOR_SLOT[jSlot] || ringIconForTier)(jTierIdx, tier.color);
  return `<div class="lootRow lootZoneCompact" data-zi="${idx}">
    <div class="lootIcon k-jackpot" style="color:${tier.color};border-color:${tier.color}">${jackpotIcon}</div>
    <div class="lootInfo"><div class="ln" style="color:${tier.color}">${tr(z.name)}</div><div class="lv">${tr(z.mob)} · ${tr(z.loot.jackpot.name)}</div></div>
    <div class="lootPct">${fmtTinyPct(jewelDropChance(tier, z.loot.jackpot.ch))} <span class="lootExpandHint">▾</span></div>
  </div>`;
}
// guide de farm (2026-07-05, demande explicite) : clic sur un emplacement de sac VIDE -- affiche
// où farmer, dans toutes les zones disponibles (débloquées), EN EXCLUANT les zones actuellement
// trop dangereuses pour le joueur (badge "ZONE DANGEREUSE", voir badgeOf/bottleneck). Réutilise le
// même récapitulatif condensé/dépliable que la vue Velia (zoneLootCompactRowHtml/zoneLootRowsHtml).
function showFarmGuide() {
  const rows = ZONES.map((z,zi) => ({ zi, dangerous: badgeOf(bottleneck(z)).txt === 'ZONE DANGEREUSE' }))
    .filter(r => r.zi <= S.maxZoneIdx && !r.dangerous);
  const html = rows.length ? rows.map(r =>
    `${zoneLootCompactRowHtml(r.zi)}<div class="lootZoneDetail" id="farmGuideDetail${r.zi}" style="display:none">${zoneLootRowsHtml(r.zi)}</div>`
  ).join('') : `<div class="admHint">${LANG==='fr'
    ? 'Aucune zone débloquée n\'est actuellement sûre pour toi — améliore ton stuff ou explore prudemment.'
    : 'No unlocked zone is currently safe for you — improve your gear or explore carefully.'}</div>`;
  const banner = `<div class="admHint">${LANG==='fr'
    ? '🗺️ Où farmer ? Zones débloquées, hors zones trop dangereuses pour ton stuff actuel — clique une zone pour voir le détail complet :'
    : '🗺️ Where to farm? Unlocked zones, excluding ones currently too dangerous for your gear — click a zone to see the full detail:'}</div>`;
  openInfo(LANG==='fr' ? '🗺️ Où farmer ?' : '🗺️ Where to farm?', banner + html);
  $a('infoBody').querySelectorAll('.lootZoneCompact').forEach(row => {
    row.onclick = () => {
      const detail = $a('farmGuideDetail'+row.dataset.zi);
      const willOpen = detail.style.display === 'none';
      detail.style.display = willOpen ? '' : 'none';
      row.classList.toggle('expanded', willOpen);
    };
  });
}
function renderLootTable(previewIdx) {
  // Velia (zone paisible) : aucun monstre, donc aucun loot possible ICI — message explicite au lieu
  // d'afficher par erreur les stats de la dernière zone farmée. On affiche à la place, à titre
  // informatif, le récapitulatif CONDENSÉ (1 ligne/zone, dépliable) du loot de TOUTES les zones de
  // Velia — demande explicite du 2026-07-08 (la version dépliée à 100% pour les 11 zones obligeait
  // à un scroll interminable).
  if (atVelia && previewIdx == null) {
    lootPreviewIdx = null;
    updateZoneViewHalo();
    $('lootZoneName').textContent = LANG==='fr' ? 'Velia — zone paisible' : 'Velia — peaceful zone';
    const banner = `<div class="admHint">${LANG==='fr'
      ? '🕊️ Zone paisible : aucun monstre, aucun loot possible ici. Aperçu condensé de ce que chaque zone de Velia peut looter — clique une zone pour voir le détail complet :'
      : '🕊️ Peaceful zone: no monsters, no loot possible here. Condensed preview of what each Velia zone can loot — click a zone to see the full detail:'}</div>`;
    const allZonesHtml = ZONES.map((z,zi) =>
      `${zoneLootCompactRowHtml(zi)}<div class="lootZoneDetail" id="lootDetail${zi}" style="display:none">${zoneLootRowsHtml(zi)}</div>`
    ).join('');
    $('lootTable').innerHTML = banner + allZonesHtml;
    $('lootTable').querySelectorAll('.lootZoneCompact').forEach(row => {
      row.onclick = () => {
        const detail = $a('lootDetail'+row.dataset.zi);
        const willOpen = detail.style.display === 'none';
        detail.style.display = willOpen ? '' : 'none';
        row.classList.toggle('expanded', willOpen);
      };
    });
    return;
  }
  const idx = previewIdx != null ? previewIdx : zoneIdx;
  lootPreviewIdx = previewIdx != null ? previewIdx : null;
  updateZoneViewHalo();
  const z = ZONES[idx];
  const previewTag = previewIdx != null && previewIdx !== zoneIdx
    ? (LANG==='fr' ? '👁 Aperçu — ' : '👁 Preview — ') : '';
  $('lootZoneName').textContent = previewTag + tr(z.mob);
  const mainRowsHtml = zoneLootRowsHtml(idx);
  // catégorie "Trésor de Velia" : identique dans toutes les zones du jeu (sortie du statut
  // expérimental le 2026-07-13, demande explicite)
  const treasureRowsHtml = VELIA_TREASURE.map(t => `
    <div class="lootRow">
      <div class="lootIcon k-treasure" style="color:${t.color};border-color:${t.color}">${t.icon}</div>
      <div class="lootInfo"><div class="ln" style="color:${t.color}">${tr(t.name)}</div></div>
      <div class="lootPct">${fmtTinyPct(t.ch)}</div>
      ${lootAutoSellLockHtml()}
    </div>`).join('');
  $('lootTable').innerHTML = mainRowsHtml +
    `<div class="lootCatHead">🗺️ ${LANG==='fr'?'Trésor de Velia':'Velia Treasure'}</div>` + treasureRowsHtml;
}
function dropItem(i) {
  const s = INV[i]; if (!s) return;
  if (forcedMatKey && s.key === forcedMatKey) forcedMatKey = null;
  INV[i] = null;
  hud();
}
// vente individuelle (bouton "Vendre 1", voir showItemMenu) — ordre de priorité STRICT avant de
// vraiment vendre quoi que ce soit, quelle que soit la provenance de l'objet (2026-07-10, demande
// explicite : "quelque soit sa provenance s'il est meilleur je l'equipe, puis je regarde si il
// doit remplacer un moins bon item dans le compendium... EQUIPE>COMPENDIUM>VENDRE") :
//   1. ÉQUIPER : si l'objet est meilleur (socle) que ce qui est déjà porté sur son slot, il prend
//      sa place au lieu d'être vendu (l'ancien retourne dans le sac, jamais perdu).
//   2. COMPENDIUM : sinon, s'il doit remplacer un exemplaire moins enchanté déjà protégé (ou s'il
//      n'y en a aucun), il rejoint le sac protégé au lieu d'être vendu (voir ensureCompendiumProtection).
//   3. VENDRE : seulement si aucun des 2 cas au-dessus ne s'applique.
function sellOne(i) {
  const s = INV[i]; if (!s) return;
  if (s.kind === 'gear' || s.kind === 'jackpot') {
    if (tryAutoEquipIfBetter(i, s)) { hud(); return; }
    if (!S.penMastery[s.name]) {
      ensureCompendiumProtection(s.name);
      if (INV[i] !== s) { hud(); return; } // ensureCompendiumProtection a pris CET exemplaire précis
    }
  }
  addSilver(s.val, 'sell', s.name);
  if (s.kind === 'gear' || s.kind === 'jackpot') INV[i] = null; else invRemoveAt(i, 1);
  hud();
}
function sellStack(i) {
  const s = INV[i]; if (!s) return;
  const total = s.val * s.qty;
  addSilver(total, 'sell', s.name);
  INV[i] = null;
  if (s.kind === 'gear' || s.kind === 'jackpot') ensureCompendiumProtection(s.name);
  hud();
}
// action combinée "Équiper → Vendre → Compendium" (2026-07-14, demande explicite) : enchaîne
// equipBestGear() puis sellWorseThanEquipped() (qui protège déjà le 1er exemplaire de chaque type
// dans le Compendium avant de vendre le reste, voir son commentaire) en une seule action. Remplace
// les anciens boutons "Vendre trash"/"Vendre mat."/"Trier" (retirés, devenus inutiles avec cette
// action unique) et leurs fonctions associées (sellAllOfKind, logSellMats).
function equipSellCompendium() {
  const equipped = equipBestGear();
  const { count, total, divertedCount } = sellWorseThanEquipped();
  return { equipped, sold: count - divertedCount, total, diverted: divertedCount };
}
$('btnEquipSellCompendium').onclick = () => {
  const { equipped, sold, total, diverted } = equipSellCompendium();
  $('btnBuyBackWorse').disabled = !lastWorseSaleSold || !lastWorseSaleSold.length;
  const msg = $('equipBestMsg');
  if (msg) {
    const parts = [];
    if (equipped > 0) parts.push(LANG==='fr' ? `${equipped} équipée${equipped>1?'s':''}` : `${equipped} equipped`);
    if (sold > 0) parts.push(LANG==='fr' ? `${sold} vendue${sold>1?'s':''} (+${fmt(total)} silver)` : `${sold} sold (+${fmt(total)} silver)`);
    if (diverted > 0) parts.push(LANG==='fr' ? `${diverted} protégée${diverted>1?'s':''} 📖` : `${diverted} protected 📖`);
    msg.textContent = parts.length ? parts.join(' · ') : (LANG==='fr' ? 'Déjà optimal — rien à faire' : 'Already optimal — nothing to do');
    msg.className = parts.length ? 'ok' : '';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};

// Les outils de debug admin d'enchantement (adminMaxEnhAllEquipped, adminResetEnhAllEquipped,
// adminStepEnhAllEquipped, wireAdminEnhStepBtn) sont desormais dans admin/enh-debug-tools.js
// (extrait le 2026-07-08, reorganisation par dossiers) -- charge APRES ce fichier, voir index.html.

// passe lootPreviewIdx explicitement : un simple renderLootTable() remettrait le loot affiché
// sur la zone qu'on farm à CHAQUE rafraîchissement auto (dès qu'un objet est ramassé), écrasant
// l'aperçu manuel choisi via le 👁 quasi instantanément
function refreshInvUI() { renderEquipment(); renderInventory(); renderCompendiumPane(); renderOptimization(); renderLootTable(lootPreviewIdx); }

// Les migrations retroactives du stuff (migrateGearRebalanceV158, migrateEarringRebalanceV175,
// migrateArmorNoApV192, migrateJewelryApV207, migrateGearFixedStatsV226, migrateGearRescaleV235/
// V243/V245, migrateJewelryMatNameV239...) sont desormais dans inventory/gear-migrations.js
// (extrait le 2026-07-08, reorganisation par dossiers) -- charge APRES ce fichier, voir index.html.