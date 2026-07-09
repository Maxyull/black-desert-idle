// Starting pets — one per section (terrain=true) + some reserves
let PETS=[
  // ⛏️ MINAGE — paire T1+T1 même section + 1 pet T2 pour tester tier+
  {id:1, cat:PET_CATALOG[0],  rar:0,stats:mkStats(0),hunger:90, terrain:true, tier:1,tierXp:0},   // Rock Mole
  {id:2, cat:PET_CATALOG[1],  rar:1,stats:mkStats(1),hunger:70, terrain:false,tier:1,tierXp:0},   // Marmot
  {id:3, cat:PET_CATALOG[2],  rar:2,stats:mkStats(2),hunger:60, terrain:false,tier:2,tierXp:400}, // Stoneback Crab
  {id:25,cat:PET_CATALOG[0],  rar:0,stats:mkStats(0),hunger:95, terrain:false,tier:1,tierXp:0},   // Rock Mole #2 (paire T1+T1)
  {id:26,cat:PET_CATALOG[4],  rar:4,stats:mkStats(4),hunger:66, terrain:false,tier:4,tierXp:8000}, // Young Gold Dragon (T4)

  // 🪓 BÛCHERON
  {id:4, cat:PET_CATALOG[6],  rar:0,stats:mkStats(0),hunger:85, terrain:true, tier:1,tierXp:0},   // Timber Squirrel
  {id:5, cat:PET_CATALOG[7],  rar:1,stats:mkStats(1),hunger:75, terrain:false,tier:1,tierXp:0},   // Kaia Jackal
  {id:6, cat:PET_CATALOG[8],  rar:2,stats:mkStats(2),hunger:65, terrain:false,tier:3,tierXp:1000},// Snowlight Lynx
  {id:27,cat:PET_CATALOG[7],  rar:1,stats:mkStats(1),hunger:80, terrain:false,tier:1,tierXp:0},   // Kaia Jackal #2 (paire T1+T1)
  {id:28,cat:PET_CATALOG[9],  rar:3,stats:mkStats(3),hunger:70, terrain:false,tier:4,tierXp:8000}, // Carmadun Owl (T4)

  // 💎 COLLECTE
  {id:7, cat:PET_CATALOG[12], rar:0,stats:mkStats(0),hunger:92, terrain:true, tier:1,tierXp:0},   // Black Mask Cat
  {id:8, cat:PET_CATALOG[13], rar:1,stats:mkStats(1),hunger:68, terrain:false,tier:1,tierXp:0},   // Grey Moon Cat
  {id:9, cat:PET_CATALOG[14], rar:2,stats:mkStats(2),hunger:55, terrain:false,tier:2,tierXp:300}, // Black Cloaked Cat
  {id:29,cat:PET_CATALOG[12], rar:0,stats:mkStats(0),hunger:88, terrain:false,tier:1,tierXp:0},   // Black Mask Cat #2 (paire T1+T1)
  {id:30,cat:PET_CATALOG[17], rar:5,stats:mkStats(5),hunger:60, terrain:false,tier:4,tierXp:8000}, // Golden Crow Sovereign (T4)

  // ✨ EXPÉRIENCE
  {id:10,cat:PET_CATALOG[18], rar:0,stats:mkStats(0),hunger:80, terrain:true, tier:1,tierXp:0},   // Calpheon Chubby Dog
  {id:11,cat:PET_CATALOG[19], rar:1,stats:mkStats(1),hunger:72, terrain:false,tier:1,tierXp:0},   // Brown Cream Puppy
  {id:12,cat:PET_CATALOG[21], rar:3,stats:mkStats(3),hunger:60, terrain:false,tier:2,tierXp:600}, // Witch Hat Charlotte
  {id:31,cat:PET_CATALOG[18], rar:0,stats:mkStats(0),hunger:84, terrain:false,tier:1,tierXp:0},   // Calpheon Chubby Dog #2 (paire T1+T1)
  {id:32,cat:PET_CATALOG[22], rar:4,stats:mkStats(4),hunger:70, terrain:false,tier:4,tierXp:8000}, // Cursed Looney (T4)

  // 🎣 PÊCHE
  {id:13,cat:PET_CATALOG[24], rar:0,stats:mkStats(0),hunger:88, terrain:true, tier:1,tierXp:0},   // Flondor Duck
  {id:14,cat:PET_CATALOG[25], rar:1,stats:mkStats(1),hunger:70, terrain:false,tier:1,tierXp:0},   // Otter
  {id:15,cat:PET_CATALOG[26], rar:2,stats:mkStats(2),hunger:58, terrain:false,tier:2,tierXp:500}, // Lost Penguin
  {id:33,cat:PET_CATALOG[24], rar:0,stats:mkStats(0),hunger:92, terrain:false,tier:1,tierXp:0},   // Flondor Duck #2 (paire T1+T1)
  {id:34,cat:PET_CATALOG[27], rar:3,stats:mkStats(3),hunger:65, terrain:false,tier:1,tierXp:0},   // Turtle

  // 🌾 FARMING
  {id:16,cat:PET_CATALOG[30], rar:0,stats:mkStats(0),hunger:90, terrain:true, tier:1,tierXp:0},   // Little Lamb
  {id:17,cat:PET_CATALOG[31], rar:1,stats:mkStats(1),hunger:75, terrain:false,tier:1,tierXp:0},   // Hedgehog
  {id:18,cat:PET_CATALOG[33], rar:3,stats:mkStats(3),hunger:62, terrain:false,tier:2,tierXp:700}, // Winter Rosefinch Set
  {id:35,cat:PET_CATALOG[30], rar:0,stats:mkStats(0),hunger:86, terrain:false,tier:1,tierXp:0},   // Little Lamb #2 (paire T1+T1)
  {id:36,cat:PET_CATALOG[34], rar:4,stats:mkStats(4),hunger:68, terrain:false,tier:4,tierXp:8000}, // Panda (T4)

  // ⚗️ ALCHIMIE
  {id:19,cat:PET_CATALOG[36], rar:0,stats:mkStats(0),hunger:82, terrain:true, tier:1,tierXp:0},   // Junaid Cat
  {id:20,cat:PET_CATALOG[37], rar:1,stats:mkStats(1),hunger:70, terrain:false,tier:1,tierXp:0},   // Drifty Ghosphy
  {id:21,cat:PET_CATALOG[39], rar:3,stats:mkStats(3),hunger:64, terrain:false,tier:3,tierXp:1100},// Scarlet Macaw
  {id:37,cat:PET_CATALOG[36], rar:0,stats:mkStats(0),hunger:90, terrain:false,tier:1,tierXp:0},   // Junaid Cat #2 (paire T1+T1)
  {id:38,cat:PET_CATALOG[40], rar:4,stats:mkStats(4),hunger:72, terrain:false,tier:4,tierXp:8000}, // Red Panda (T4)

  // ⚔️ COMBAT
  {id:22,cat:PET_CATALOG[42], rar:0,stats:mkStats(0),hunger:78, terrain:true, tier:1,tierXp:0},   // Brown Fighting Dog
  {id:23,cat:PET_CATALOG[43], rar:1,stats:mkStats(1),hunger:74, terrain:false,tier:1,tierXp:0},   // Snow Wolfdog
  {id:24,cat:PET_CATALOG[44], rar:2,stats:mkStats(2),hunger:60, terrain:false,tier:2,tierXp:400}, // Black Cloaked Dog
  {id:39,cat:PET_CATALOG[42], rar:0,stats:mkStats(0),hunger:82, terrain:false,tier:1,tierXp:0},   // Brown Fighting Dog #2 (paire T1+T1)
  {id:40,cat:PET_CATALOG[45], rar:3,stats:mkStats(3),hunger:68, terrain:false,tier:4,tierXp:8000}, // Helter-Skelter Ceros (T4)

  // 🔺 PETS SUPPLÉMENTAIRES — comble T5 (absent) et renforce T3
  {id:41,cat:PET_CATALOG[3],  rar:3,stats:mkStats(3),hunger:70, terrain:false,tier:5,tierXp:0},    // Polar Bear (Minage, T5)
  {id:42,cat:PET_CATALOG[10], rar:4,stats:mkStats(4),hunger:65, terrain:false,tier:5,tierXp:0},    // Midnight Lynx (Bûcheron, T5)
  {id:43,cat:PET_CATALOG[16], rar:4,stats:mkStats(4),hunger:72, terrain:false,tier:3,tierXp:1000}, // Sky Hawk (Collecte, T3)
  {id:44,cat:PET_CATALOG[23], rar:5,stats:mkStats(5),hunger:60, terrain:false,tier:5,tierXp:0},    // Archsage Wyrm (Expérience, T5)
  {id:45,cat:PET_CATALOG[29], rar:5,stats:mkStats(5),hunger:68, terrain:false,tier:3,tierXp:1000}, // Abyssal Leviathan Spirit (Pêche, T3)
  {id:46,cat:PET_CATALOG[35], rar:5,stats:mkStats(5),hunger:62, terrain:false,tier:5,tierXp:0},    // Harvestmoon Deity Fawn (Farming, T5)
  {id:47,cat:PET_CATALOG[41], rar:5,stats:mkStats(5),hunger:66, terrain:false,tier:3,tierXp:1000}, // Voidcaller Wyrmling (Alchimie, T3)
  {id:48,cat:PET_CATALOG[46], rar:4,stats:mkStats(4),hunger:70, terrain:false,tier:5,tierXp:0},    // Young Black Dragon (Combat, T5)
];
PETS.forEach(p=>{if(!p.rar&&p.rar!==0)p.rar=p.cat.rar;});

let incubSlots=[{free:true,tl:0,tot:21600,ready:true},{free:false,tl:13800,tot:21600,ready:false},{free:false,tl:null,tot:null,locked:true}];
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
let eggTimer=5*3600+42*60+18;
let specialTickCounter=0; // cadence les drops Caphras/Dopi/Boss toutes les 2s (le tick principal tourne toutes les 1s)
// FOODS supprimé — la nourriture provient désormais directement de INVENTORY (loot du hardinage)
