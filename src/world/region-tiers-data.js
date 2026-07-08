// ==================== PALIERS DE REGIONS (Velia/Heidel/Calpheon...) ====================
// Extrait de game-core.js le 2026-07-08 (reorganisation par dossiers) -- pure donnee, aucune
// dependance, charge AVANT core/game-core.js.
// trésors-teaser des 2 prochains paliers (2026-07-15, demande explicite : "créer 2 nouvelles cartes
// qui se loot dans les prochaines zones heidel et calpheon" puis renommés "tresor de heilde /
// tresors de calpheon" -- même famille que "Trésor de Velia", pas des "cartes" séparées) --
// Heidel/Calpheon restent verrouillés (zones pas encore construites, confirmé "zone bloqué"), ces
// objets ne sont donc PAS obtenables pour l'instant : juste un aperçu affiché dans le tooltip du
// palier verrouillé (voir renderZoneTierTabs) et un couple de recettes verrouillées dans Assemblage
// (voir renderTreasureCraftPanel) prêtes pour le jour où le palier ouvrira. Le "Coffret secret" (voir
// craftSecretCombo) combine désormais les 3 Trésors régionaux (Velia + Heidel + Calpheon) —
// c'était le sens original de "combiner 3 cartes différentes" demandé plus tôt.
const TIER_PREVIEW_CARD = {
  mid: { name:'Trésor de Heidel', icon:'🗺️', color:'#6ea3c9', key:'treasure_heidel' },
  end: { name:'Trésor de Calpheon', icon:'🗺️', color:'#e0935a', key:'treasure_calpheon' },
};
const ZONE_TIERS = [
  { id:'early', icon:'🟢', label:{fr:'Velia',en:'Velia'},       locked:false },
  { id:'mid',   icon:'🔵', label:{fr:'Heidel',en:'Heidel'},     locked:true },
  { id:'end',   icon:'🟡', label:{fr:'Calpheon',en:'Calpheon'}, locked:true },
  { id:'end2',  icon:'🟠', label:{fr:'Valencia',en:'Valencia'}, locked:true },
  { id:'end3',  icon:'🔴', label:{fr:'Edana',en:'Edana'},       locked:true },
];
