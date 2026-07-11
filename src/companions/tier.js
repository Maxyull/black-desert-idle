// ═══ TIER SYSTEM (indépendant de la rareté) ═══
// Un pet monte de Tier via XP de travail. Chaque Tier a sa PROPRE plage de multiplicateur
// (comme la rareté a sa plage de stats) : on tire un multiplicateur aléatoire dans la
// fourchette du tier à chaque montée, pas une valeur fixe.
// Chevauchement volontaire : un Commun T5 bien roulé peut dépasser un Peu Commun T1 mal roulé,
// mais un Peu Commun T5 maxé battra TOUJOURS un Commun T5 maxé (les plafonds sont différents).
const TIER_MULT_RANGE = [
  [1.00, 1.05], // T1
  [1.08, 1.15], // T2
  [1.18, 1.28], // T3
  [1.32, 1.45], // T4
  [1.50, 1.65], // T5
];
const TIER_XP_NEEDED = [0, 800, 2200, 5000, 10000]; // XP cumulé requis pour atteindre ce tier

// Chance qu'une montée de Tier déclenche un bond de rareté (reset à T1 si ça arrive).
// Volontairement très bas : un pet peut monter des dizaines de fois en Tier avant
// de croiser ce jackpot. 0.015 = 1.5% par montée de tier.
const RARITY_BREAKTHROUGH_CHANCE = 0.015;

function rollTierMult(tier){
  const [lo,hi] = TIER_MULT_RANGE[tier-1];
  return +(lo + Math.random()*(hi-lo)).toFixed(3);
}
function tierMultOf(pet){
  if(pet.tierMult===undefined) pet.tierMult = rollTierMult(pet.tier||1); // rétro-compat pets existants
  return pet.tierMult;
}
function tierMultPct(pet){
  const [lo,hi] = TIER_MULT_RANGE[(pet.tier||1)-1];
  return Math.round((tierMultOf(pet)-lo)/(hi-lo)*100);
}
function tierXpMaxFor(pet){
  const t=(pet.tier||1);
  return t>=5 ? null : (TIER_XP_NEEDED[t] - TIER_XP_NEEDED[t-1]);
}

// ═══ STATE ═══════════════════════════════════════════════════════
let petId=100;
function rs(rar,i){const[lo,hi]=STAT_RANGES[rar][i];if(lo===0&&hi===0)return 0;return+(lo+Math.random()*(hi-lo)).toFixed(1);}
function mkStats(rar){return Array(5).fill(0).map((_,i)=>i<BONUS_COUNT[rar]?rs(rar,i):0);}

// ═══ GEARSCORE ═══════════════════════════════════════════════════
function maxGS(rar,tier){
  // Max théorique pour cette rareté à un tier donné (borne HAUTE de la plage du tier).
  // Sans tier précisé → Tier 5 au maximum (référence absolue).
  const mult = tier ? TIER_MULT_RANGE[tier-1][1] : TIER_MULT_RANGE[4][1];
  let t=0;for(let i=0;i<BONUS_COUNT[rar];i++)t+=STAT_RANGES[rar][i][1];
  return t*mult;
}
function minGS(rar,tier){
  // Min théorique pour cette rareté à un tier donné (borne BASSE de la plage du tier, stats au plancher).
  const mult = tier ? TIER_MULT_RANGE[tier-1][0] : TIER_MULT_RANGE[0][0];
  let t=0;for(let i=0;i<BONUS_COUNT[rar];i++)t+=STAT_RANGES[rar][i][0];
  return t*mult;
}
function curGS(pet){
  // GS effectif = (somme des stats brutes × multiplicateur de tier) + bonus permanents de Caphras
  let t=0;for(let i=0;i<BONUS_COUNT[pet.rar];i++)t+=(pet.stats[i]||0);
  const caphrasTotal = (pet.caphrasBonus||[]).reduce((s,v)=>s+(v||0),0);
  return t*tierMultOf(pet) + caphrasTotal;
}
function gsPct(pet){
  // % du max atteignable pour SA rareté à SON tier actuel (à quel point ce pet est bien roulé)
  const mx=maxGS(pet.rar,pet.tier||1);
  return mx>0?Math.round(curGS(pet)/mx*100):0;
}
function normGS(pet){
  // GS absolu sur 1000 = comparé au max théorique universel (Ancestral, Tier 5, toutes stats max)
  return Math.round(curGS(pet)/maxGS(5,5)*1000);
}
function avgGSForRarityAtTier1(rar){
  // GS moyen attendu d'un pet de cette rareté fraîchement éclos (Tier 1, stats moyennes = milieu de fourchette)
  let t=0;
  for(let i=0;i<BONUS_COUNT[rar];i++){
    const [lo,hi]=STAT_RANGES[rar][i];
    t+=(lo+hi)/2;
  }
  const t1AvgMult = (TIER_MULT_RANGE[0][0]+TIER_MULT_RANGE[0][1])/2; // multiplicateur moyen attendu au Tier 1
  return Math.round(t*t1AvgMult/maxGS(5,5)*1000);
}
function comparisonBadge(pet){
  // Compare ce pet à la moyenne T1 de la rareté immédiatement supérieure
  if(pet.rar>=5) return null; // déjà Ancestral, rien au-dessus
  const nextRarAvg = avgGSForRarityAtTier1(pet.rar+1);
  const myGS = normGS(pet);
  if(myGS >= nextRarAvg){
    return {beats:true, text:`🔺 Dépasse ${RARITIES[pet.rar+1].name} T1 moyen`, delta: myGS-nextRarAvg};
  } else {
    return {beats:false, text:`🔻 Sous ${RARITIES[pet.rar+1].name} T1 moyen`, delta: myGS-nextRarAvg};
  }
}
function gsCls(pct){return pct>=90?'gs-max':pct>=65?'gs-high':pct>=35?'gs-med':'gs-low';}
function rc(r){return RARITIES[r].hex;}
function rn(r){return RARITIES[r].name;}
function secById(id){return SECTIONS.find(s=>s.id===id);}
function petSec(p){return p.cat.sec;}
function terrainPet(secId){return PETS.find(p=>p.cat.sec===secId&&p.terrain);}
