// Roster de départ (2026-07-10, demande explicite) : 0 pet -- le joueur part de zéro et éclot
// son premier familier via le slot gratuit déjà prêt ci-dessous.
let PETS=[];

// Plafond de collection (2026-07-20, demande explicite : "Borner collection a 96 pets prévoir 4
// depaçable pour recuperer des pet venant d'un trade") -- 96 = plafond normal (hatching), bloqué
// dans doHatch()/bulkHatch() (hatch.js) via petRosterRoomLeft(). Les 4 slots
// supplémentaires (jusqu'à 100) sont réservés pour un futur système de trade -- AUCUN code ne les
// consomme encore (pas de feature trade construite), volontairement laissés en headroom plutôt que
// consommés par le hatching normal.
const PET_ROSTER_CAP = 96;
const PET_ROSTER_CAP_WITH_TRADE_BUFFER = 100;
/** @returns {number} places restantes avant PET_ROSTER_CAP (96) — gate doHatch()/bulkHatch(), jamais négatif. */
function petRosterRoomLeft(){ return Math.max(0, PET_ROSTER_CAP - PETS.length); }

// Timers d'incubation (voir TEST_BALANCE_DIVISOR, economy.js) : 21600s (6h) et
// 13800s de base, réduits pour tester le flux rapidement -- repasser TEST_BALANCE_DIVISOR à 1
// dans economy.js pour revenir aux vrais timers.
let incubSlots=[{free:true,tl:0,tot:scaleTimer(21600),ready:true},{free:false,tl:scaleTimer(13800),tot:scaleTimer(21600),ready:false},{free:false,tl:null,tot:null,locked:true}];
let fusionSlots=[null,null];
let activeSecIdx=0;
let sortMode='gs',sortDir=-1;
let filterSec=new Set(),filterRar=new Set(),filterTierColl=new Set(); // vide = "tous" ; aucune limite de sélection
/** @param {Set} setObj - un des filterSec/filterRar/filterTierColl. @param {*} value - valeur à basculer. Ajoute/retire `value` du Set puis rafraîchit filtres+grille. */
function toggleFilter(setObj, value){
  if(setObj.has(value)) setObj.delete(value);
  else setObj.add(value);
  renderFilters(); renderGrid();
}
/** Vide tous les filtres de collection (section/rareté/tier) et le champ de recherche, rafraîchit filtres+grille. */
function clearAllFilters(){
  filterSec.clear(); filterRar.clear(); filterTierColl.clear();
  const sb=document.getElementById('search-box'); if(sb) sb.value='';
  renderFilters(); renderGrid();
}
let searchQ='';
let selFoodName = null; // nom de l'objet d'inventaire actuellement sélectionné pour nourrir
let eggTimer=scaleTimer(5*3600+42*60+18);
let specialTickCounter=0; // cadence les drops Caphras/Dopi/Boss toutes les 2s (le tick principal tourne toutes les 1s)
// FOODS supprimé — la nourriture provient désormais directement de INVENTORY (loot du hardinage)
