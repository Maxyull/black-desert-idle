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
