// ═══ PET DATABASE ════════════════════════════════════════════════
const RARITIES=[
  {id:0,name:'Commun',    hex:'#888'},
  {id:1,name:'Peu commun',hex:'#44b060'},
  {id:2,name:'Rare',      hex:'#4488cc'},
  {id:3,name:'Épique',    hex:'#9944cc'},
  {id:4,name:'Légendaire',hex:'#cc8820'},
  {id:5,name:'Ancestral', hex:'#cc3030'},
];
const BONUS_COUNT=[1,2,3,4,5,5];
const STAT_RANGES=[
  [[1,3],[0,0],[0,0],[0,0],[0,0]],
  [[3,7],[1,4],[0,0],[0,0],[0,0]],
  [[7,14],[4,7],[2,6],[0,0],[0,0]],
  [[14,25],[7,14],[6,12],[2,7],[0,0]],
  [[22,38],[12,22],[10,18],[6,12],[4,8]],
  [[38,60],[22,38],[18,30],[12,20],[8,15]],
];

const SECTIONS=[
  {id:'loot',    name:'Collecte',   ico:'💎',sk:['Vitesse collecte','Rayon','Chance double','Qualité loot','Loot bonus'],
    drops:[{e:'🏺',n:'Butin',v:15,feed:12},{e:'🔑',n:'Clé de coffre',v:120,feed:30},{e:'💰',n:'Sac de pièces',v:0,silver:true}]},
  {id:'xp',      name:'Expérience', ico:'✨',sk:['Bonus XP combat','Bonus XP compét.','Durée parchemin','XP zone','XP passif'],
    drops:[{e:'📄',n:'Note de combat',v:10,feed:10},{e:'📜',n:'Parchemin XP',v:200,feed:28},{e:'📚',n:'Tome de sagesse',v:600,feed:55}]},
  {id:'minage',  name:'Minage',     ico:'⛏️',sk:['Vitesse minage','Qualité minerai','Chance filon','Minerai rare','Veine légend.'],
    drops:[{e:'🪨',n:'Minerai de fer',v:8,feed:10},{e:'💎',n:'Pierre noire',v:250,feed:32},{e:'🔮',n:'Cristal de mana',v:800,feed:60}]},
  {id:'bucheron',name:'Bûcheron',   ico:'🪓',sk:['Vitesse coupe','Qualité bois','Chance essence','Bois rare','Cœur d\'arbre'],
    drops:[{e:'🪵',n:'Bois de pin',v:6,feed:9},{e:'🌿',n:'Résine',v:90,feed:24},{e:'🌲',n:'Essence de sylvanite',v:400,feed:48}]},
  {id:'peche',   name:'Pêche',      ico:'🎣',sk:['Vitesse pêche','Qualité poisson','Chance trésor','Poisson rare','Perle'],
    drops:[{e:'🐟',n:'Poisson',v:9,feed:14},{e:'🦞',n:'Homard',v:140,feed:34},{e:'🔮',n:'Perle des dieux',v:900,feed:65}]},
  {id:'farming', name:'Farming',    ico:'🌾',sk:['Vitesse récolte','Rendement','Chance mutation','Récolte rare','Graine d\'éveil'],
    drops:[{e:'🌽',n:'Récolte',v:7,feed:13},{e:'🌺',n:'Fleur enchantée',v:110,feed:30},{e:'🌱',n:'Graine d\'éveil',v:700,feed:58}]},
  {id:'alchimie',name:'Alchimie',   ico:'⚗️',sk:['Bonus craft','Chance proc','Vitesse alchimie','Ingréd. rare','Noyau chaos'],
    drops:[{e:'🧪',n:'Réactif',v:9,feed:11},{e:'🌙',n:'Poudre de lune',v:160,feed:29},{e:'💫',n:'Noyau de chaos',v:850,feed:62}]},
  {id:'combat',  name:'Combat',     ico:'⚔️',sk:['Bonus PA','Bonus DP','Réduction dégâts','Vitesse attaque','Aura combat'],
    drops:[{e:'🦴',n:'Os broyé',v:8,feed:10},{e:'🗡️',n:'Fragment d\'arme',v:180,feed:31},{e:'👑',n:'Couronne du Conquérant',v:1200,feed:70}]},
];

// ═══ LOOT SPÉCIAL — Caphras, Pierres de Dopi, Items de Boss ═══════
// Le Tier du pet représente la difficulté de zone qu'il peut affronter :
// plus le Tier est haut, plus il trouve de Caphras/Dopi. Les items de Boss
// restent extrêmement rares quel que soit le Tier (1×10⁻⁸ par tick de 2s,
// espérance ≈ 1.26/an avec 8 pets actifs — voir calcul dans la conversation).
const CAPHRAS_ITEM = {e:'🔺', n:'Pierre de Caphras', feed:22};
const DOPI_ITEMS = [
  {e:'💊', n:'Pierre de Dopi (Faible)',  feed:14, baseRate:0.006},
  {e:'💊', n:'Pierre de Dopi (Moyenne)', feed:26, baseRate:0.0018},
  {e:'💊', n:'Pierre de Dopi (Forte)',   feed:45, baseRate:0.0003},
];
const CAPHRAS_BASE_RATE = 0.003; // 0.3% par tick de 2s au Tier 1

const BOSS_ITEMS = {
  loot:     {e:'👑', n:'Cœur de Kzarka'},
  xp:       {e:'📕', n:"Tome Interdit d'Ordo"},
  minage:   {e:'⚫', n:'Noyau de Terre Primordiale'},
  bucheron: {e:'🌰', n:"Graine de l'Arbre-Monde"},
  peche:    {e:'🐚', n:'Écaille de Léviathan Ancien'},
  farming:  {e:'✨', n:'Semence Divine'},
  alchimie: {e:'🧿', n:'Élixir de Kutum'},
  combat:   {e:'💀', n:'Crâne de Nouver'},
};
const BOSS_ITEM_RATE = 1e-8; // 0.000001% par tick de 2s, flat (indépendant du tier)

// Facteur de difficulté de zone = Tier du pet. T1=×1 ... T5=×5 pour Caphras/Dopi.
function zoneTierFactor(pet){ return (pet.tier||1); }

// Pet catalog: name, artKey, rarity, section, type, origin(classic/rare/premium)
const PET_CATALOG=[
  // ⛏️ MINAGE
  {name:'Rock Mole',              art:'rock_mole',    rar:0,sec:'minage',  typ:'Rongeur',  orig:'invented'},
  {name:'Marmot',                 art:'marmot',       rar:1,sec:'minage',  typ:'Pelucheux',orig:'premium'},
  {name:'Stoneback Crab',         art:'crab',         rar:2,sec:'minage',  typ:'Aquatique',orig:'premium'},
  {name:'Polar Bear',             art:'bear_polar',   rar:3,sec:'minage',  typ:'Ours',     orig:'rare'},
  {name:'Young Gold Dragon',      art:'dragon_gold',  rar:4,sec:'minage',  typ:'Dragon',   orig:'rare'},
  {name:'Newborn Golden Dragon',  art:'dragon_new_gold',rar:5,sec:'minage',typ:'Dragon',   orig:'rare'},

  // 🪓 BÛCHERON
  {name:'Timber Squirrel',        art:'squirrel',     rar:0,sec:'bucheron',typ:'Rongeur',  orig:'invented'},
  {name:'Kaia Jackal',            art:'fox_desert',   rar:1,sec:'bucheron',typ:'Canidé',   orig:'classic'},
  {name:'Snowlight Lynx',         art:'lynx',         rar:2,sec:'bucheron',typ:'Lynx',     orig:'rare'},
  {name:'Carmadun Owl',           art:'owl',          rar:3,sec:'bucheron',typ:'Oiseau',   orig:'premium'},
  {name:'Midnight Lynx',          art:'lynx_dark',    rar:4,sec:'bucheron',typ:'Lynx',     orig:'rare'},
  {name:'Elder Grovewarden',      art:'grovewarden',  rar:5,sec:'bucheron',typ:'Esprit',   orig:'invented'},

  // 💎 COLLECTE
  {name:'Black Mask Cat',         art:'cat_black',    rar:0,sec:'loot',    typ:'Félidé',   orig:'classic'},
  {name:'Grey Moon Cat',          art:'cat_grey',     rar:1,sec:'loot',    typ:'Félidé',   orig:'classic'},
  {name:'Black Cloaked Cat',      art:'cat_black',    rar:2,sec:'loot',    typ:'Félidé',   orig:'rare'},
  {name:'Karlstein Cat',          art:'cat_black',    rar:3,sec:'loot',    typ:'Félidé',   orig:'premium'},
  {name:'Sky Hawk',               art:'hawk_sky',     rar:4,sec:'loot',    typ:'Oiseau',   orig:'premium'},
  {name:'Golden Crow Sovereign',  art:'golden_crow',  rar:5,sec:'loot',    typ:'Oiseau',   orig:'invented'},

  // ✨ EXPÉRIENCE
  {name:'Calpheon Chubby Dog',    art:'dog_puppy',    rar:0,sec:'xp',      typ:'Canidé',   orig:'classic'},
  {name:'Brown Cream Puppy',      art:'dog_puppy',    rar:1,sec:'xp',      typ:'Canidé',   orig:'classic'},
  {name:'Neurotic Cabby',         art:'dog_shaggy',   rar:2,sec:'xp',      typ:'Canidé',   orig:'rare'},
  {name:'Witch Hat Charlotte',    art:'ghost',        rar:3,sec:'xp',      typ:'Esprit',   orig:'rare'},
  {name:'Cursed Looney',          art:'ghost',        rar:4,sec:'xp',      typ:'Esprit',   orig:'rare'},
  {name:'Archsage Wyrm',          art:'archsage_wyrm',rar:5,sec:'xp',      typ:'Dragon',   orig:'invented'},

  // 🎣 PÊCHE
  {name:'Flondor Duck',           art:'rosefinch',    rar:0,sec:'peche',   typ:'Canard',   orig:'classic'},
  {name:'Otter',                  art:'otter',        rar:1,sec:'peche',   typ:'Aquatique',orig:'premium'},
  {name:'Lost Penguin',           art:'penguin',      rar:2,sec:'peche',   typ:'Aquatique',orig:'rare'},
  {name:'Turtle',                 art:'turtle',       rar:3,sec:'peche',   typ:'Aquatique',orig:'premium'},
  {name:'Depthking Kraken',       art:'kraken',       rar:4,sec:'peche',   typ:'Aquatique',orig:'invented'},
  {name:'Abyssal Leviathan Spirit',art:'leviathan',   rar:5,sec:'peche',   typ:'Esprit',   orig:'invented'},

  // 🌾 FARMING
  {name:'Little Lamb',            art:'lamb',         rar:0,sec:'farming', typ:'Pelucheux',orig:'premium'},
  {name:'Hedgehog',               art:'hedgehog',      rar:1,sec:'farming', typ:'Pelucheux',orig:'rare'},
  {name:'Cushy Mallowmerz',       art:'lamb',          rar:2,sec:'farming', typ:'Pelucheux',orig:'rare'},
  {name:'Winter Rosefinch Set',   art:'rosefinch',     rar:3,sec:'farming', typ:'Oiseau',   orig:'rare'},
  {name:'Panda',                  art:'panda',         rar:4,sec:'farming', typ:'Ours',     orig:'premium'},
  {name:'Harvestmoon Deity Fawn', art:'fawn',          rar:5,sec:'farming', typ:'Esprit',   orig:'invented'},

  // ⚗️ ALCHIMIE
  {name:'Junaid Cat',             art:'cat_orange',    rar:0,sec:'alchimie',typ:'Félidé',   orig:'classic'},
  {name:'Drifty Ghosphy',        art:'ghost',          rar:1,sec:'alchimie',typ:'Esprit',   orig:'rare'},
  {name:'Snowkid',                art:'snowkid',       rar:2,sec:'alchimie',typ:'Esprit',   orig:'rare'},
  {name:'Scarlet Macaw',          art:'macaw',         rar:3,sec:'alchimie',typ:'Oiseau',   orig:'premium'},
  {name:'Red Panda',              art:'red_panda',     rar:4,sec:'alchimie',typ:'Pelucheux',orig:'premium'},
  {name:'Voidcaller Wyrmling',    art:'void_wyrm',     rar:5,sec:'alchimie',typ:'Dragon',   orig:'invented'},

  // ⚔️ COMBAT
  {name:'Brown Fighting Dog',     art:'dog_guard',     rar:0,sec:'combat', typ:'Canidé',   orig:'classic'},
  {name:'Snow Wolfdog',           art:'dog_wolf',      rar:1,sec:'combat', typ:'Canidé',   orig:'classic'},
  {name:'Black Cloaked Dog',      art:'dog_wolf',      rar:2,sec:'combat', typ:'Canidé',   orig:'rare'},
  {name:'Helter-Skelter Ceros',   art:'griffon',       rar:3,sec:'combat', typ:'Mythique', orig:'rare'},
  {name:'Young Black Dragon',     art:'dragon_black',  rar:4,sec:'combat', typ:'Dragon',   orig:'rare'},
  {name:'Newborn Crimson Dragon', art:'dragon_crim',   rar:5,sec:'combat', typ:'Dragon',   orig:'rare'},
];

// Complétion Index (2026-07-20, demande explicite : "Completion 48pet * 5 tier pour l'index et
// classement") -- avant, la complétion comptait seulement l'ESPÈCE possédée (48 max, indifférent
// au palier). Désormais compte chaque combo ESPÈCE×TIER distinct réellement possédé (48×5=240
// max) : avoir juste "1 Rock Mole T1" ne compte plus comme "Rock Mole complet", il faut l'avoir
// possédé à CHAQUE palier (T1 à T5) pour que les 5 combos de cette espèce soient acquis.
// Réutilisé par leaderboard.js ("Tes stats") ET sync.js (stat envoyée à
// l'admin) — un seul point de calcul, jamais dupliqué.
const COMPANION_INDEX_MAX = PET_CATALOG.length * 5; // 240
function companionIndexSpeciesTierKey(p){ return p.cat.name + '_T' + (p.tier||1); }
function companionIndexProgress(petsList){
  return new Set((petsList||[]).map(companionIndexSpeciesTierKey)).size;
}
