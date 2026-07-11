// ==================== UTILISATION DES POTIONS (cout dynamique + UI selecteur) ====================
// Extrait de game-core.js le 2026-07-08 (reorganisation par dossiers) -- DOIT charger APRES
// core/game-core.js et combat/potions-data.js (POTIONS/POTION_ORDER) : tout est reference en
// execution (function bodies), aucune evaluation immediate.
// prix des potions = un POURCENTAGE du revenu horaire théorique de trash (token vendu au sol,
// jamais du prix de vente du stuff) de la zone ACTUELLE (2026-07-11/12, demande explicite : "revois
// le prix des potion en fonction de l'argent qu'on se fait en vendant les token en instantané...
// uniquement par rapport à ça" puis "les potions doivent couter entre 5 et 30% de ce que tu gagne
// en silver"). Remplace l'ancien amortissement en racine carrée (potionZoneScale, 2026-07-09) : il
// dérivait fortement de son propre objectif déclaré ("mega ~15% du revenu horaire") -- vérifié en
// simulation, le ratio réel allait de 42% (Camp des Loups) à 3.6% (Forêt de Polly) au lieu de rester
// stable, un ratio sqrt(zone.trash/zone0.trash) dérivant nécessairement à mesure que l'écart entre
// zones grandit. Ici chaque taille de potion coûte un % du revenu horaire de trash de SA PROPRE
// zone (jamais relatif à une zone de référence, donc jamais de dérive) : interpolé linéairement
// entre 5% (small) et 30% (mega) selon le coût de base de la taille (70/140/240/380), ce qui reste
// vrai dans TOUTE zone.
const POTION_KPM_REF = 15; // même rythme que la courbe économique des zones (~3000/h zone1 → ~100000/h zone11)
// prix divisé par 10 une 2e fois le 2026-07-14 (demande explicite : "divise par 10 le prix des
// potion") -- small ≈ 0.05% du revenu horaire, mega ≈ 0.3% (au lieu de 0.5%/3%, déjà divisé par 10
// une 1ère fois le 2026-07-12)
const POTION_PCT_MIN = 0.0005; // small ≈ 0.05% du revenu horaire
const POTION_PCT_MAX = 0.003;  // mega ≈ 0.3% du revenu horaire
/** @returns {number} revenu horaire théorique de trash de la zone actuelle (référence pour tarifer les potions, jamais une zone fixe). */
function potionHourlyIncome() {
  const z = (typeof atVelia !== 'undefined' && !atVelia && typeof Z === 'function') ? Z() : ZONES[0];
  return (z.loot.trash.val || 1) * POTION_KPM_REF * 60;
}
/** @param {number} baseCost - coût de base de la taille de potion (POTIONS.small..mega.cost). @returns {number} prix réel en silver, interpolé linéairement entre POTION_PCT_MIN/MAX du revenu horaire de la zone actuelle. */
function potionCost(baseCost) {
  if (!baseCost) return 0;
  const lo = POTIONS.small.cost, hi = POTIONS.mega.cost;
  const t = hi > lo ? (baseCost - lo) / (hi - lo) : 0;
  const pct = POTION_PCT_MIN + t * (POTION_PCT_MAX - POTION_PCT_MIN);
  return Math.max(1, Math.round(potionHourlyIncome() * pct));
}
// icône unique vie+mana (2026-07-08, demande explicite : "la potion qui remplace les 2 potion")
// -- remplace les 2 cases séparées #potSlot/#manaPotSlot par une seule, fiole ronde rouge (vie) +
// fiole élancée bleue (mana) penchées l'une vers l'autre, volutes entrelacées animées
const ICO_POTION_DUO = `<svg class="gicon" viewBox="0 0 44 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 15 C 10 10, 20 7, 16 2" fill="none" stroke="#e88a8a" stroke-width="1.6" stroke-linecap="round" opacity=".7">
    <animate attributeName="d" values="M15 15 C 10 10, 20 7, 16 2;M15 15 C 20 10, 12 7, 17 2;M15 15 C 10 10, 20 7, 16 2" dur="3.2s" repeatCount="indefinite"/>
  </path>
  <path d="M25 16 C 30 10, 20 8, 24 2" fill="none" stroke="#8ab0e8" stroke-width="1.6" stroke-linecap="round" opacity=".7">
    <animate attributeName="d" values="M25 16 C 30 10, 20 8, 24 2;M25 16 C 21 10, 29 8, 23 2;M25 16 C 30 10, 20 8, 24 2" dur="3.2s" begin="1.6s" repeatCount="indefinite"/>
  </path>
  <g transform="translate(14,25) rotate(-12)">
    <circle cx="0" cy="4" r="8.5" fill="#7a1f24"/>
    <circle cx="0" cy="4" r="8.5" fill="none" stroke="#3a171a" stroke-width="1"/>
    <path d="M-1.8 2.5 h3.6 M0 0.6 v3.8" stroke="#ffb0b0" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="-2.2" y="-7" width="4.4" height="4.2" rx="1" fill="#5a3f22"/>
  </g>
  <g transform="translate(28,24) rotate(10)">
    <path d="M0 -4 C 4.2 1.5, 5.5 6.5, 3.8 11.5 Q 0 15.5 -3.8 11.5 C -5.5 6.5, -4.2 1.5, 0 -4 z" fill="#243a8a"/>
    <path d="M0 -4 C 4.2 1.5, 5.5 6.5, 3.8 11.5 Q 0 15.5 -3.8 11.5 C -5.5 6.5, -4.2 1.5, 0 -4 z" fill="none" stroke="#141f4a" stroke-width="1"/>
    <path d="M1.3 5 a2.4 2.4 0 1 1 -2 -3.6 a2 2 0 0 0 2 3.6 z" fill="#a8c4ff"/>
    <path d="M-1 -9 l1.2 -2.4 1.2 2.4 v3.2 h-2.4 z" fill="#5a7ac9"/>
  </g>
</svg>`;
// avertissement "pas assez de silver pour la potion" -- avant ce correctif (2026-07-06, remonté en
// jeu : "les potions ne fonctionnent pas") l'échec était TOTALEMENT silencieux (juste un retry
// rapide sans soin), ce qui passait pour un bug, surtout en zone dangereuse où les dégâts encaissés
// sont énormes ET le silver s'épuise vite. 1 toast/3s max pour ne pas spammer vu le retry à 1s.
let lastPotionSilverWarn = 0;
/** Affiche un toast "pas assez de silver" (au plus 1/3s vu le retry à 1s) quand une potion ne peut pas être payée. */
function warnPotionNoSilver() {
  const now = performance.now();
  if (now - lastPotionSilverWarn < 3000) return;
  lastPotionSilverWarn = now;
  floatTxt(P.x, P.y-15, 75, i18next.t('combat:combat.potion.no_silver_warning'), {hurt:true});
}
/** Consomme la potion de PV sélectionnée (S.potionType) : débite le silver (retry sans soin si insuffisant), soigne un % des PV max, relance le cooldown. */
function usePotion() {
  const pot = POTIONS[S.potionType] || POTIONS.medium;
  const cost = potionCost(pot.cost);
  if (cost > 0) {
    if (S.silver < cost) { P.potCd = 1; warnPotionNoSilver(); return; } // pas assez de silver : réessaie vite, aucun soin
    addSilver(-cost, 'potion', pot.name.fr);
    floatTxt(P.x,P.y,80,'-'+fmt(cost)+'🪙',{hurt:true});
  }
  P.potCd = pot.cd;
  P.hp = Math.min(effHpMax(), P.hp + effHpMax()*pot.heal);
  floatTxt(P.x,P.y,90,'+PV',{green:true});
}
// potion de mana (2026-07-05, demande explicite : "ajoute ... une potion de mana") -- un seul
// palier pour l'instant (pas de choix de taille comme les potions de PV), même mécanique
/** Consomme la potion de mana (palier unique) : débite le silver (retry sans soin si insuffisant), restaure un % du mana max, relance le cooldown. */
function usePotionMana() {
  const cost = potionCost(MANA_POTION.cost);
  if (S.silver < cost) { P.manaPotCd = 1; warnPotionNoSilver(); return; } // pas assez de silver : réessaie vite
  addSilver(-cost, 'potion', MANA_POTION.name.fr);
  floatTxt(P.x,P.y,80,'-'+fmt(cost)+'🪙',{hurt:true});
  P.manaPotCd = MANA_POTION.cd;
  P.mp = Math.min(effManaMax(), P.mp + effManaMax()*MANA_POTION.restore);
  floatTxt(P.x,P.y,90,'+MP',{blue:true});
}
// sélecteur de potion : le joueur choisit laquelle des 4 tailles utiliser automatiquement en
// combat — le soin affiché (en PV) dépend de ses PV max actuels, mis à jour à chaque ouverture
/** Reconstruit le panneau sélecteur de potion (4 tailles PV + info mana), recalculé à chaque ouverture (PV max/coûts peuvent avoir changé), câble clics + slider de seuil d'auto-soin. */
function renderPotSelect() {
  const el = $('potSelect'); if (!el) return;
  const threshPct = Math.round((S.potionThreshold ?? 0.5) * 100);
  const threshRow = `<div id="potThreshRow"><span>${i18next.t('combat:combat.potion.drink_under')}</span>` +
    `<input type="range" id="potThreshSlider" min="5" max="95" step="5" value="${threshPct}">` +
    `<span id="potThreshVal">${threshPct}%</span></div>`;
  const rows = POTION_ORDER.map(key => {
    const p = POTIONS[key];
    const healHp = Math.round(effHpMax()*p.heal);
    if (p.locked) {
      return `<div class="psRow locked" title="${i18next.t('combat:combat.potion.coming_soon')}">` +
        `<span class="psIcon">🔒</span>` +
        `<span class="psInfo"><span class="psName">${p.name[LANG]}</span><br><span class="psHeal">+${Math.round(p.heal*100)}% PV · CD ${p.cd}s</span></span>` +
        `<span class="psCost">${i18next.t('combat:combat.potion.free_label')}</span></div>`;
    }
    return `<div class="psRow${S.potionType===key?' sel':''}" data-pot="${key}">` +
      `<span class="psIcon">${p.icon}</span>` +
      `<span class="psInfo"><span class="psName">${p.name[LANG]}</span><br><span class="psHeal">+${fmt(healHp)} PV (${Math.round(p.heal*100)}%) · CD ${p.cd}s</span></span>` +
      `<span class="psCost">${fmt(potionCost(p.cost))} 🪙</span></div>`;
  }).join('');
  // section mana (2026-07-08, demande explicite : "qui ouvre le pannel de potion vie et mana") --
  // un seul palier pour l'instant (pas de choix de taille comme les potions de vie), donc juste
  // informatif : boit automatiquement sous 30% de mana, pas de sélection à faire ici
  const manaSection = `<div class="psSectionLabel">${i18next.t('combat:combat.potion.hp_potion_section')}</div>` +
    rows +
    `<div class="psSectionLabel">${i18next.t('combat:combat.potion.mana_potion_section')}</div>` +
    `<div class="psRow psRowInfo">` +
      `<span class="psIcon">🔷</span>` +
      `<span class="psInfo"><span class="psName">${MANA_POTION.name[LANG]}</span><br><span class="psHeal">+${Math.round(MANA_POTION.restore*100)}% MP · CD ${MANA_POTION.cd}s</span></span>` +
      `<span class="psCost">${fmt(potionCost(MANA_POTION.cost))} 🪙</span></div>`;
  el.innerHTML = threshRow + manaSection;
  // .psRowInfo (ligne mana) exclue : purement informative, aucune taille à choisir (voir plus haut)
  el.querySelectorAll('.psRow:not(.locked):not(.psRowInfo)').forEach(row => {
    row.onclick = e => { e.stopPropagation(); S.potionType = row.dataset.pot; el.classList.remove('show'); };
  });
  const slider = $('potThreshSlider');
  slider.oninput = e => { e.stopPropagation(); S.potionThreshold = Number(slider.value)/100; $('potThreshVal').textContent = slider.value+'%'; };
  slider.onclick = e => e.stopPropagation();
}
function togglePotSelect(e) {
  e.stopPropagation();
  const el = $('potSelect');
  const willShow = !el.classList.contains('show');
  if (willShow) renderPotSelect();
  el.classList.toggle('show', willShow);
}
