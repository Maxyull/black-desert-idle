// ═══ BOOTSTRAP — dernier fichier chargé (voir README.md) ═════════
/** Rafraîchit tous les panneaux du module Compagnons (éclosion, sections, grille/filtres, fusion, nourrir, header, jeu, inventaire, succès). Appelé une fois au boot puis à chaque changement d'état global. */
function renderAll(){
  renderHatch();
  renderSecNav();renderSecDetail();
  renderFilters();renderGrid();
  updateFusionUI();
  renderFeed();updateHeader();
  renderGameView();
  renderCollInventory();
  checkAchievements();
}
if(!loadGame()) checkDailyStreak();
renderAll();
// version bas gauche (2026-07-20, demande explicite : "ajoute version en bas a gauche")
const cvEl=document.getElementById('companion-version');
if(cvEl) cvEl.textContent='Compagnon — '+COMPANION_MODULE_VERSION;
// onboarding (2026-07-11, demande explicite) -- après renderAll(), une seule fois par navigateur
if(typeof maybeShowOnboarding==='function') maybeShowOnboarding();
