// ==================== MODES IA : COMBAT & FARM ====================
// Extrait de progression/notifications-quests.js le 2026-07-08 (reorganisation par dossiers,
// correction : ces 2 systemes concernent le comportement de combat/farm de l'IA, pas la
// progression -- ils avaient atterri ici par accident lors du gros decoupage V307) -- DOIT
// charger APRES core/game-core.js (S, LANG, $).

// mode de combat IA -- ÉTAIT auto-calculé depuis le ratio de gear (bottleneck()), REMPLACÉ le
// 2026-07-14 (demande explicite, décision confirmée malgré la conception précédente) par un choix
// manuel du joueur, voir S.aiCombatMode et AI_COMBAT_MODES/setAiCombatMode ci-dessous.
/** @returns {string} mode de combat IA choisi manuellement par le joueur (S.aiCombatMode), 'équilibré' par défaut/repli. */
function aiMode() {
  return AI_COMBAT_MODES[S.aiCombatMode] ? S.aiCombatMode : 'équilibré';
}
const AI_COMBAT_MODES = {
  'défensif':  { icon:'🛡️', name:{fr:'Défensif',  en:'Defensive'} },
  'équilibré': { icon:'⚖️', name:{fr:'Équilibré', en:'Balanced'} },
  'overgeared':{ icon:'⚔️', name:{fr:'Offensif',  en:'Overgeared'} },
};
const AI_COMBAT_MODE_ORDER = ['défensif','équilibré','overgeared'];
function renderAiModeBtn() {
  const el = $('aiModeSlider'); if (!el) return;
  if (!AI_COMBAT_MODES[S.aiCombatMode]) S.aiCombatMode = 'équilibré';
  const titles = {
    'défensif':  i18next.t('combat:combat.ai_mode.defensive_title'),
    'équilibré': i18next.t('combat:combat.ai_mode.balanced_title'),
    'overgeared':i18next.t('combat:combat.ai_mode.overgeared_title'),
  };
  el.querySelectorAll('.aiModeSeg').forEach(seg => {
    const key = seg.dataset.mode, m = AI_COMBAT_MODES[key];
    const active = S.aiCombatMode === key;
    seg.classList.toggle('active', active);
    seg.title = titles[key] || '';
    // style F (2026-07-12, demande explicite) : icône+texte visibles en permanence, plus
    // seulement sur le segment actif -- seule la classe .active (fond doré/texte sombre) change.
    seg.innerHTML = `<span class="farmModeSegIcon">${m.icon}</span><span class="farmModeSegLabel">${m.name[LANG]}</span>`;
  });
}
/** @param {string} key - clé de AI_COMBAT_MODES. No-op si clé inconnue. */
function setAiCombatMode(key) {
  if (!AI_COMBAT_MODES[key]) return;
  S.aiCombatMode = key;
  renderAiModeBtn();
}

// mode de farm choisi par le joueur : "Loot" ramasse tout avant de passer au pack suivant (voir
// killPack + case 'loot' du fsm), "XP" ignore le loot au sol et enchaîne les packs pour maximiser
// les kills/xp par minute (demande : 2 IA différentes, une full-loot, une full-XP)
// mode "Opti" (pack to pack rapide) retiré le 2026-07-14 (demande explicite) : un 3e emplacement
// reste affiché dans le sélecteur, verrouillé (cadenas grisé), en attente d'un futur 3e mode.
const FARM_MODES = {
  loot: { icon:'🎒', name:{fr:'Loot', en:'Loot'} },
  xp:   { icon:'⚡', name:{fr:'XP',   en:'XP'} },
};
const FARM_MODE_ORDER = ['loot','xp'];
// sélecteur à bulles (2026-07-14, demande explicite : "petit selecteur a bulle") -- remplace le
// slider <input type="range"> par une pilule segmentée : le mode actif s'affiche en capsule dorée
// pleine (icône + texte), les autres modes en icône seule, et un 3e rond grisé/verrouillé (aucun
// mode derrière pour l'instant) ferme la pilule.
function renderFarmModeBtn() {
  const el = $('farmModeSlider'); if (!el) return;
  // repli (2026-07-14) : une sauvegarde existante peut encore avoir S.farmMode==='opti' (mode
  // retiré) -- sans ce filet, aucune bulle ne s'affiche active tant que le joueur n'en reclique pas une
  if (!FARM_MODES[S.farmMode]) S.farmMode = 'loot';
  const titles = {
    loot: i18next.t('combat:combat.ai_mode.farm_loot_title'),
    xp:   i18next.t('combat:combat.ai_mode.farm_xp_title'),
  };
  el.querySelectorAll('.farmModeSeg').forEach(seg => {
    const key = seg.dataset.mode, m = FARM_MODES[key];
    const active = S.farmMode === key;
    seg.classList.toggle('active', active);
    seg.title = titles[key] || '';
    // style F (2026-07-12, demande explicite) : icône+texte visibles en permanence, plus
    // seulement sur le segment actif -- seule la classe .active (fond doré/texte sombre) change.
    seg.innerHTML = `<span class="farmModeSegIcon">${m.icon}</span><span class="farmModeSegLabel">${m.name[LANG]}</span>`;
  });
}
/** @param {string} key - clé de FARM_MODES ('loot'/'xp'). No-op si clé inconnue. */
function setFarmMode(key) {
  if (!FARM_MODES[key]) return;
  S.farmMode = key;
  renderFarmModeBtn();
}

