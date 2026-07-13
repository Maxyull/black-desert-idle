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

/** @param {number} tier - palier (1-5). @returns {number} multiplicateur tiré aléatoirement dans TIER_MULT_RANGE[tier-1], arrondi à 3 décimales. */
function rollTierMult(tier){
  const [lo,hi] = TIER_MULT_RANGE[tier-1];
  return +(lo + Math.random()*(hi-lo)).toFixed(3);
}
/** @param {object} pet - familier. @returns {number} multiplicateur de tier RÉELLEMENT tiré pour ce pet (tiré une fois et mémorisé sur pet.tierMult, rétro-compat pets sans ce champ). */
function tierMultOf(pet){
  if(pet.tierMult===undefined) pet.tierMult = rollTierMult(pet.tier||1); // rétro-compat pets existants
  return pet.tierMult;
}
/** @param {object} pet - familier. @returns {number} position (0-100) du multiplicateur réellement tiré dans la plage de son tier. */
function tierMultPct(pet){
  const [lo,hi] = TIER_MULT_RANGE[(pet.tier||1)-1];
  return Math.round((tierMultOf(pet)-lo)/(hi-lo)*100);
}
/** @param {object} pet - familier. @returns {?number} XP requise pour passer au tier suivant (null si déjà Tier 5, max atteint). */
function tierXpMaxFor(pet){
  const t=(pet.tier||1);
  return t>=5 ? null : (TIER_XP_NEEDED[t] - TIER_XP_NEEDED[t-1]);
}

// ═══ STATE ═══════════════════════════════════════════════════════
let petId=100;
/** @param {number} rar - rareté. @param {number} i - index de stat. @returns {number} valeur tirée dans STAT_RANGES[rar][i] (0 si la plage est [0,0], stat inactive). */
function rs(rar,i){const[lo,hi]=STAT_RANGES[rar][i];if(lo===0&&hi===0)return 0;return+(lo+Math.random()*(hi-lo)).toFixed(1);}
/** @param {number} rar - rareté. @returns {number[]} 5 stats tirées (les BONUS_COUNT[rar] premières actives, le reste à 0) — état initial d'un familier fraîchement éclos/fusionné. */
function mkStats(rar){return Array(5).fill(0).map((_,i)=>i<BONUS_COUNT[rar]?rs(rar,i):0);}

// ═══ GEARSCORE ═══════════════════════════════════════════════════
/** @param {number} rar - rareté. @param {number} [tier] - palier (sans tier = Tier 5, référence absolue). @returns {number} GS théorique max (stats au plafond × multiplicateur haut du tier). */
function maxGS(rar,tier){
  // Max théorique pour cette rareté à un tier donné (borne HAUTE de la plage du tier).
  // Sans tier précisé → Tier 5 au maximum (référence absolue).
  const mult = tier ? TIER_MULT_RANGE[tier-1][1] : TIER_MULT_RANGE[4][1];
  let t=0;for(let i=0;i<BONUS_COUNT[rar];i++)t+=STAT_RANGES[rar][i][1];
  return t*mult;
}
/** @param {number} rar - rareté. @param {number} [tier] - palier (sans tier = Tier 1, plancher absolu). @returns {number} GS théorique min (stats au plancher × multiplicateur bas du tier). */
function minGS(rar,tier){
  // Min théorique pour cette rareté à un tier donné (borne BASSE de la plage du tier, stats au plancher).
  const mult = tier ? TIER_MULT_RANGE[tier-1][0] : TIER_MULT_RANGE[0][0];
  let t=0;for(let i=0;i<BONUS_COUNT[rar];i++)t+=STAT_RANGES[rar][i][0];
  return t*mult;
}
/**
 * Gearscore effectif d'un pet (somme des stats brutes actives × multiplicateur de tier, plus les
 * bonus permanents de Caphras). Base de curGS/gsPct/normGS ci-dessous.
 * @param {object} pet - lit .rar, .stats[], .tier, .caphrasBonus[].
 * @returns {number} GS effectif, non normalisé (échelle dépend de la rareté).
 */
function curGS(pet){
  let t=0;for(let i=0;i<BONUS_COUNT[pet.rar];i++)t+=(pet.stats[i]||0);
  const caphrasTotal = (pet.caphrasBonus||[]).reduce((s,v)=>s+(v||0),0);
  return t*tierMultOf(pet) + caphrasTotal;
}
/**
 * % du GS max atteignable pour SA rareté à SON tier actuel — à quel point ce pet est bien roulé
 * dans sa propre fourchette (indépendant des autres raretés/tiers).
 * @param {object} pet - lit .rar, .tier (+ tout ce que curGS()/maxGS() lisent).
 * @returns {number} pourcentage entier 0-100.
 */
function gsPct(pet){
  const mx=maxGS(pet.rar,pet.tier||1);
  return mx>0?Math.round(curGS(pet)/mx*100):0;
}
/**
 * GS absolu normalisé sur une échelle 0-1000, comparé au max théorique universel (Ancestral,
 * Tier 5, toutes stats au plafond) — seule mesure comparable ENTRE pets de raretés différentes
 * (contrairement à curGS()/gsPct() qui restent relatifs à la rareté du pet).
 * @param {object} pet - lit .rar, .tier (+ tout ce que curGS() lit).
 * @returns {number} GS normalisé, entier 0-1000.
 */
function normGS(pet){
  return Math.round(curGS(pet)/maxGS(5,5)*1000);
}
/** @param {number} rar - rareté. @returns {number} GS normalisé (0-1000) moyen attendu d'un pet fraîchement éclos de cette rareté (stats au milieu de fourchette, multiplicateur T1 moyen). */
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
// ═══ CHEVAUCHEMENT PROGRESSIF ENTRE PALIERS DE GS (2026-07-13, demande explicite) ═══
// Avant ce changement, aucun cutoff dur "GS < X -> palier A, GS >= X -> palier B" ne pilotait
// réellement un tier affiché (le Tier 1-5 d'un pet monte par XP, pas par GS -- voir
// TIER_XP_NEEDED plus haut) : le seul endroit du code qui décidait un tirage à 2 issues à partir
// d'un écart de rareté était baseRarityDraw() (fusion.js), avec un facteur basé UNIQUEMENT sur
// l'écart de rareté brut (rarGap), jamais sur le GS réel des parents. progressiveTierProbability()
// généralise le principe "chevauchement progressif autour d'un seuil" en fonction pure testable,
// utilisée par baseRarityDraw() (fusion.js) pour faire dépendre la probabilité de la rareté HAUTE
// du GS réel du parent le plus faible, en plus de l'écart de rareté déjà pris en compte.
/**
 * Rampe linéaire de probabilité autour d'un seuil : 0% en dessous de (threshold-band), 100%
 * au-dessus de (threshold+band), progression linéaire entre les deux (chevauchement progressif,
 * remplace un cutoff net "gs<threshold ? bas : haut").
 * @param {number} gs - valeur mesurée (ex: normGS(), 0-1000).
 * @param {number} threshold - valeur charnière entre les 2 paliers.
 * @param {number} band - demi-largeur de la zone de transition (même unité que gs/threshold ;
 *   ex. threshold*0.10 pour une zone de ±10% du seuil). band<=0 retombe sur un cutoff dur.
 * @returns {number} probabilité (0-1) de tomber dans le palier SUPÉRIEUR.
 */
function progressiveTierProbability(gs, threshold, band){
  if(band<=0) return gs>=threshold ? 1 : 0;
  const t = (gs - (threshold-band)) / (band*2);
  return Math.max(0, Math.min(1, t));
}
/** @param {object} pet - familier. @returns {?{beats:boolean, text:string, delta:number}} comparaison de son GS normalisé à la moyenne T1 de la rareté supérieure, null si déjà Ancestral. */
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
/** @param {number} pct - pourcentage de GS (0-100, voir gsPct()). @returns {string} classe CSS de couleur associée au palier de qualité. */
function gsCls(pct){return pct>=90?'gs-max':pct>=65?'gs-high':pct>=35?'gs-med':'gs-low';}
/** @param {number} r - index de rareté. @returns {string} couleur hex associée. */
function rc(r){return RARITIES[r].hex;}
/** @param {number} r - index de rareté. @returns {string} nom affichable de la rareté. */
function rn(r){return RARITIES[r].name;}
/** @param {string} id - id de section. @returns {object|undefined} définition de section correspondante dans SECTIONS. */
function secById(id){return SECTIONS.find(s=>s.id===id);}
/** @param {object} p - familier. @returns {string} id de section de son espèce. */
function petSec(p){return p.cat.sec;}
/** @param {string} secId - id de section. @returns {object|undefined} le pet actuellement marqué "terrain" (posé sur la carte) de cette section, s'il y en a un. */
function terrainPet(secId){return PETS.find(p=>p.cat.sec===secId&&p.terrain);}
// espèce pour une section+rareté donnée (2026-07-21, demande explicite : "lorsqu'on passe a la
// rareté superieur, on change de nom et on prend les noms de la rareté superieur") -- PET_CATALOG
// a EXACTEMENT une espèce par section×rareté (voir catalog.js), match déterministe garanti.
// Partagée entre ticks.js (BREAKTHROUGH, temps réel) et save.js (migratePetSpeciesRarityV1,
// rétroactif) pour ne jamais dupliquer cette règle à deux endroits.
/** @param {string} sec - id de section. @param {number} rar - rareté cible. @returns {object|undefined} l'unique espèce de PET_CATALOG pour cette combinaison section×rareté. */
function speciesForSectionAndRarity(sec,rar){return PET_CATALOG.find(c=>c.sec===sec&&c.rar===rar);}
