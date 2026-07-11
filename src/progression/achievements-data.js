// ==================== SUCCES (definitions) ====================
// Extrait de game-core.js le 2026-07-08 (reorganisation par dossiers) -- DOIT charger APRES
// core/game-core.js : target:ZONES.length/PRI_IDX/ENH_NAMES.length-1 sont evalues immediatement
// au chargement (ZONES vient de world/zones-data.js, PRI_IDX/ENH_NAMES de core/game-core.js).
const ACHIEVEMENTS = [
  { id:'first_kill',   icon:'🗡️', name:{fr:'Premier sang',        en:'First blood'},        desc:{fr:'Terrasse ton premier monstre',              en:'Defeat your first monster'},               statFn:S=>S.kills,               target:1,               reward:300 },
  { id:'kills_100',    icon:'⚔️', name:{fr:'Chasseur',            en:'Hunter'},              desc:{fr:'Terrasse 100 monstres',                     en:'Defeat 100 monsters'},                     statFn:S=>S.kills,               target:100,             reward:1500 },
  { id:'kills_1000',   icon:'⚔️', name:{fr:'Exterminateur',       en:'Exterminator'},        desc:{fr:'Terrasse 1 000 monstres',                   en:'Defeat 1,000 monsters'},                   statFn:S=>S.kills,               target:1000,            reward:8000 },
  { id:'kills_10000',  icon:'💀', name:{fr:'Faucheur',            en:'Reaper'},              desc:{fr:'Terrasse 10 000 monstres',                  en:'Defeat 10,000 monsters'},                  statFn:S=>S.kills,               target:10000,           reward:40000 },
  { id:'loot_1',       icon:'🎒', name:{fr:'Premier butin',       en:'First loot'},          desc:{fr:'Ramasse ton premier objet',                 en:'Pick up your first item'},                 statFn:S=>S.lootCount,           target:1,               reward:200 },
  { id:'loot_500',     icon:'🎒', name:{fr:'Collectionneur',      en:'Collector'},           desc:{fr:'Ramasse 500 objets',                        en:'Loot 500 items'},                          statFn:S=>S.lootCount,           target:500,             reward:4000 },
  { id:'loot_5000',    icon:'🎒', name:{fr:'Accumulateur',        en:'Hoarder'},             desc:{fr:'Ramasse 5 000 objets',                      en:'Loot 5,000 items'},                        statFn:S=>S.lootCount,           target:5000,            reward:25000 },
  { id:'silver_10k',   icon:'🪙', name:{fr:'Petite fortune',      en:'Small fortune'},       desc:{fr:'Gagne 10 000 silver au total',              en:'Earn a total of 10,000 silver'},           statFn:S=>S.silverEarned,        target:10000,           reward:1000 },
  { id:'silver_100k',  icon:'🪙', name:{fr:'Marchand',            en:'Merchant'},            desc:{fr:'Gagne 100 000 silver au total',             en:'Earn a total of 100,000 silver'},          statFn:S=>S.silverEarned,        target:100000,          reward:5000 },
  { id:'silver_1m',    icon:'💰', name:{fr:'Riche marchand',      en:'Wealthy merchant'},    desc:{fr:'Gagne 1 000 000 silver au total',           en:'Earn a total of 1,000,000 silver'},        statFn:S=>S.silverEarned,        target:1000000,         reward:20000 },
  { id:'silver_10m',   icon:'💰', name:{fr:'Magnat',              en:'Tycoon'},              desc:{fr:'Gagne 10 000 000 silver au total',          en:'Earn a total of 10,000,000 silver'},       statFn:S=>S.silverEarned,        target:10000000,        reward:100000 },
  { id:'zone_2',       icon:'🗺️', name:{fr:'Explorateur',         en:'Explorer'},            desc:{fr:'Atteins la 2e zone de farm',                en:'Reach the 2nd farming zone'},              statFn:S=>S.maxZoneIdx+1,        target:2,               reward:1500 },
  { id:'zone_6',       icon:'🗺️', name:{fr:'Aventurier',          en:'Adventurer'},          desc:{fr:'Atteins la 6e zone de farm',                en:'Reach the 6th farming zone'},              statFn:S=>S.maxZoneIdx+1,        target:6,               reward:15000 },
  { id:'zone_last',    icon:'🏔️', name:{fr:'Conquérant de Velia', en:'Conqueror of Velia'},  desc:{fr:'Atteins la dernière zone de farm',          en:'Reach the final farming zone'},            statFn:S=>S.maxZoneIdx+1,        target:ZONES.length,    reward:120000 },
  { id:'gs_50',        icon:'🛡️', name:{fr:'Bien équipé',         en:'Well equipped'},       desc:{fr:'Atteins 50 de Gearscore',                   en:'Reach 50 Gearscore'},                      statFn:()=>GS(),                 target:50,              reward:5000 },
  { id:'gs_150',       icon:'🛡️', name:{fr:'Vétéran équipé',      en:'Veteran gear'},        desc:{fr:'Atteins 150 de Gearscore',                  en:'Reach 150 Gearscore'},                     statFn:()=>GS(),                 target:150,             reward:25000 },
  { id:'gs_300',       icon:'🛡️', name:{fr:'Légende vivante',     en:'Living legend'},       desc:{fr:'Atteins 300 de Gearscore',                  en:'Reach 300 Gearscore'},                     statFn:()=>GS(),                 target:300,             reward:90000 },
  { id:'enh_pri',      icon:'✨', name:{fr:'Étincelle divine',    en:'Divine spark'},        desc:{fr:'Amène une pièce d\'équipement au niveau PRI',en:'Bring one piece of gear to PRI level'},    statFn:()=>maxEnhLv(),           target:PRI_IDX,         reward:20000 },
  { id:'enh_max',      icon:'🌟', name:{fr:'Perfection',          en:'Perfection'},          desc:{fr:'Amène une pièce d\'équipement au niveau PEN (max)', en:'Bring one piece of gear to PEN (max) level'}, statFn:()=>maxEnhLv(), target:ENH_NAMES.length-1, reward:150000 },
  { id:'jackpot_1',    icon:'💎', name:{fr:'Coup de chance',      en:'Lucky strike'},        desc:{fr:'Trouve ton premier bijou rare',             en:'Find your first rare jewelry drop'},       statFn:S=>S.jackpotCount||0,     target:1,               reward:2000 },
  { id:'gear_1',       icon:'⚙️', name:{fr:'Nouvel équipement',   en:'New gear'},            desc:{fr:'Trouve ta première pièce d\'équipement',    en:'Find your first piece of gear'},           statFn:S=>S.gearDropCount||0,    target:1,               reward:800 },
  { id:'playtime_1h',  icon:'⏱️', name:{fr:'Habitué',             en:'Regular'},             desc:{fr:'Joue pendant 1 heure au total',             en:'Play for a total of 1 hour'},              statFn:S=>S.playtimeSec,         target:3600,            reward:1500 },
  { id:'playtime_10h', icon:'⏱️', name:{fr:'Dévoué',              en:'Dedicated'},           desc:{fr:'Joue pendant 10 heures au total',           en:'Play for a total of 10 hours'},            statFn:S=>S.playtimeSec,         target:36000,           reward:12000 },
  { id:'treasure_1',   icon:'🗺️', name:{fr:'Chercheur de trésor', en:'Treasure seeker'},     desc:{fr:'Trouve ton premier morceau du Trésor de Velia', en:'Find your first Velia Treasure piece'},  statFn:S=>treasureTotal(S),      target:1,               reward:5000 },
  { id:'treasure_10',  icon:'🗺️', name:{fr:'Chasseur de trésor',  en:'Treasure hunter'},     desc:{fr:'Trouve 10 morceaux du Trésor de Velia (tous types)', en:'Find 10 Velia Treasure pieces (any type)'}, statFn:S=>treasureTotal(S), target:10,              reward:30000 },
];
// catégories de succès (demande utilisateur : silver, butin, temps de jeu, exploration,
// équipement — + combat pour les kills)
const ACH_CATS = {
  combat:      { icon:'⚔️', label:{fr:'Combat',en:'Combat'} },
  butin:       { icon:'🎒', label:{fr:'Butin',en:'Loot'} },
  silver:      { icon:'🪙', label:{fr:'Silver',en:'Silver'} },
  playtime:    { icon:'⏱️', label:{fr:'Temps de jeu',en:'Playtime'} },
  exploration: { icon:'🗺️', label:{fr:'Exploration',en:'Exploration'} },
  equipment:   { icon:'🛡️', label:{fr:'Équipement',en:'Equipment'} },
  treasure:    { icon:'🗺️', label:{fr:'Trésor de Velia',en:'Velia Treasure'} },
};
function achCat(id) {
  if (id === 'first_kill' || id.startsWith('kills')) return 'combat';
  if (id.startsWith('loot')) return 'butin';
  if (id.startsWith('silver')) return 'silver';
  if (id.startsWith('playtime')) return 'playtime';
  if (id.startsWith('treasure')) return 'treasure';
  if (id.startsWith('zone')) return 'exploration';
  return 'equipment'; // gs_*, enh_*, jackpot_1, gear_1
}

// ==================== SUCCES : chaînes de paliers (refonte visuelle 2026-07-11) ====================
// Port fidèle du mockup validé par l'utilisateur (voir CLAUDE.md section mockups) : le panneau
// Succès affiche désormais UNE carte par "chaîne" de paliers (ex: Premier sang -> Chasseur ->
// Exterminateur -> Faucheur, tous statFn:S=>S.kills) au lieu d'une ligne par palier individuel.
// Regroupement purement dérivé côté client -- ACHIEVEMENTS/ACH_CATS/achCat() ci-dessus restent la
// seule source de vérité, rien n'est dupliqué ni modifié ici.
//
// Clé de chaîne = catégorie + identité textuelle du statFn : deux succès qui suivent EXACTEMENT la
// même formule de progression appartiennent à la même chaîne. Les succès sans palier frère
// (jackpot_1, gear_1) ressortent naturellement en chaîne à 1 seul élément -- aucun cas particulier
// nécessaire, une Map préserve l'ordre d'insertion == ordre de ACHIEVEMENTS (donc l'ordre des
// paliers dans chaque chaîne reste croissant, comme le tableau source).
function groupAchievementsIntoChains() {
  const chains = new Map();
  for (const a of ACHIEVEMENTS) {
    const key = achCat(a.id) + '::' + a.statFn.toString();
    if (!chains.has(key)) chains.set(key, { key, cat: achCat(a.id), tiers: [] });
    chains.get(key).tiers.push(a);
  }
  return Array.from(chains.values());
}
// progression d'une chaîne pour un état de sauvegarde `S` donné. Le palier "actif" retourné est
// TOUJOURS le premier palier pas encore débloqué -- ou le DERNIER palier si la chaîne est déjà
// entièrement débloquée (jamais un palier intermédiaire une fois que tous ses successeurs sont eux
// aussi débloqués : règle explicite du mockup -- un check vert n'apparaît que quand TOUTE la chaîne
// est à 100%, jamais sur un palier isolé). `pct` suit le même calcul que nextAchievement()
// (notifications-quests.js) : statFn(S)/target, borné à 99% tant que non débloqué, fixé à 100 une
// fois la chaîne terminée (jamais recalculé au-delà).
function chainProgress(chain, S) {
  const tiers = chain.tiers;
  const unlockedCount = tiers.filter(a => !!S.achUnlocked[a.id]).length;
  const done = unlockedCount === tiers.length;
  const tierIndex = done ? tiers.length - 1 : tiers.findIndex(a => !S.achUnlocked[a.id]);
  const tier = tiers[tierIndex];
  const val = tier.statFn(S);
  const pct = done ? 100 : Math.max(0, Math.min(99, (val / tier.target) * 100));
  return { tier, tierIndex, unlockedCount, totalTiers: tiers.length, done, pct, val };
}
// tri d'affichage des cartes du panneau Succès : chaînes en cours d'abord (triées par % décroissant,
// même formule que nextAchievement()), chaînes 100% terminées reléguées en fin de liste.
function sortChainsForDisplay(chains, S) {
  const withProgress = chains.map(chain => ({ chain, progress: chainProgress(chain, S) }));
  withProgress.sort((x, y) => {
    if (x.progress.done !== y.progress.done) return x.progress.done ? 1 : -1;
    return y.progress.pct - x.progress.pct;
  });
  return withProgress;
}
// répartition du silver de récompense déjà gagné (succès débloqués) vs encore à débloquer --
// alimente la carte de vue d'ensemble du panneau Succès, calculée en direct depuis S.achUnlocked
// (jamais une valeur figée) pour ne jamais dériver du vrai état du joueur.
function achievementSilverTotals(S) {
  let earned = 0, remaining = 0;
  for (const a of ACHIEVEMENTS) {
    if (S.achUnlocked[a.id]) earned += a.reward; else remaining += a.reward;
  }
  return { earned, remaining };
}
// complétion réelle (débloqués/total) d'une catégorie donnée ('all' = toutes) -- alimente les
// tuiles de filtre par catégorie (anneau de progression), toujours calculée depuis le vrai état,
// jamais une valeur inventée.
function achCatCompletion(catId, S) {
  const list = catId === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => achCat(a.id) === catId);
  const done = list.filter(a => S.achUnlocked[a.id]).length;
  return { done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
}
// derniers succès débloqués, triés du plus récent au plus ancien, limités à `limit` -- s'appuie sur
// l'horodatage réel déjà stocké dans S.achUnlocked[a.id] = Date.now() (checkAchievements(),
// notifications-quests.js). Filtre défensif sur `typeof === 'number'` : cet horodatage a TOUJOURS
// été un Date.now() depuis son introduction (jamais un simple booléen `true`), mais on ignore toute
// entrée qui ne serait pas un timestamp valide plutôt que d'afficher un "il y a NaN" au joueur.
function recentlyUnlockedAchievements(S, limit) {
  return ACHIEVEMENTS
    .filter(a => typeof S.achUnlocked[a.id] === 'number' && S.achUnlocked[a.id] > 0)
    .sort((a, b) => S.achUnlocked[b.id] - S.achUnlocked[a.id])
    .slice(0, limit);
}
