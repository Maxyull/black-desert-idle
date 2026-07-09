// ═══ BOOTSTRAP — dernier fichier chargé (voir README.md) ═════════
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
