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
// ==================== SCEAU DU CONCLAVE DES MARCHANDS (2026-07-13, port de mockup) ====================
// Trésor légendaire multi-région : 5 fragments ("Sceaux de Guilde"), un par ZONE_TIERS. Port du
// mockup fourni (tresor-sceau-conclave.md), adapté sur 2 points confirmés avec l'utilisateur :
// 1. Scope Velia UNIQUEMENT pour l'instant -- Heidel/Calpheon/Valencia/Edana restent `locked` (voir
//    ZONE_TIERS ci-dessus), donc leurs 4 fragments ne sont PAS obtenables tant que ces régions ne
//    sortent pas (même statut que TIER_PREVIEW_CARD juste au-dessus -- pas un bug).
// 2. "Marché Noir des Guildes" (mockup original) retiré -- aucun système de guilde n'existe dans ce
//    jeu (CLAUDE.md : "pas d'onglet Guildes"). Remplacé par "Aperçu du prix moyen" (voir market.js,
//    conclaveSealAvgPriceHtml) : moyenne des 10 dernières ventes réelles (table market_trades,
//    déjà lue côté client par refreshBuyModalLadderAndStats -- aucune nouvelle table nécessaire).
const CONCLAVE_SEAL_FRAGMENTS = [
  { tierId:'early', key:'conclave_seal_velia',    name:'Sceau du Port Ancestral',      icon:'📜', color:'#c8a96e' },
  { tierId:'mid',   key:'conclave_seal_heidel',   name:'Sceau du Chevalier de la Plaine', icon:'📜', color:'#6ea3c9' },
  { tierId:'end',   key:'conclave_seal_calpheon', name:'Sceau de la Cour Républicaine', icon:'📜', color:'#e0935a' },
  { tierId:'end2',  key:'conclave_seal_valencia', name:'Sceau du Désert Ardent',        icon:'📜', color:'#d47a4a' },
  { tierId:'end3',  key:'conclave_seal_edana',    name:'Sceau de l\'Œil d\'Ynix',        icon:'📜', color:'#c0503c' }, // "Eldia" du document original corrigé en "Edana" (vrai nom de région, voir ZONE_TIERS)
];
const CONCLAVE_SEAL_LORE = {
  fr: 'Cinq sceaux, cinq cités, cinq serments. Le Conclave des Marchands ne se réunit qu\'une fois par génération — et celui qui porte leurs cinq sceaux réunis est reconnu par chaque guilde du continent. Les douaniers s\'inclinent. Les taxes disparaissent. L\'argent coule.',
  en: 'Five seals, five cities, five oaths. The Merchants\' Conclave gathers only once a generation — and whoever bears all five seals united is recognized by every guild on the continent. Customs officers bow. Taxes vanish. Silver flows.',
};
/** @param {string} tierId - id ZONE_TIERS. @returns {boolean} vrai si ce fragment est obtenable AUJOURD'HUI (région non verrouillée). */
function conclaveSealFragmentUnlocked(tierId) {
  const t = ZONE_TIERS.find(z => z.id === tierId);
  return !!t && !t.locked;
}
