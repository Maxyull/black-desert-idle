// Roster de départ (2026-07-10, demande explicite) : 0 pet -- le joueur part de zéro et éclot
// son premier familier via le slot gratuit déjà prêt ci-dessous.
let PETS=[];

// Timers d'incubation (voir TEST_BALANCE_DIVISOR, companions.economy.js) : 21600s (6h) et
// 13800s de base, réduits pour tester le flux rapidement -- repasser TEST_BALANCE_DIVISOR à 1
// dans companions.economy.js pour revenir aux vrais timers.
let incubSlots=[{free:true,tl:0,tot:scaleTimer(21600),ready:true},{free:false,tl:scaleTimer(13800),tot:scaleTimer(21600),ready:false},{free:false,tl:null,tot:null,locked:true}];
let fusionSlots=[null,null];
let activeSecIdx=0;
let sortMode='gs',sortDir=-1;
let filterSec=new Set(),filterRar=new Set(),filterTierColl=new Set(); // vide = "tous" ; aucune limite de sélection
function toggleFilter(setObj, value){
  if(setObj.has(value)) setObj.delete(value);
  else setObj.add(value);
  renderFilters(); renderGrid();
}
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
