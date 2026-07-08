// Extrait de game-core.js le 2026-07-08 (reorganisation par dossiers, prepare l'ajout futur
// d'autres classes jouables) -- pure donnee (SKILLS/MANA_REGEN_PER_SEC/MANA_POTION) + un petit
// forEach immediat qui initialise les cooldowns -- DOIT charger AVANT core/game-core.js.
// ==================== COMPÉTENCES ====================
// mp (2026-07-05, demande explicite : "ajoute de la mana au sort") : coût en mana par lancer,
// grossièrement proportionnel à la puissance/au cooldown du sort -- avec mpMax:100 et une régén
// passive (voir MANA_REGEN_PER_SEC), gate occasionnellement les gros sorts sans jamais bloquer
// durablement le combat automatique (les petits sorts bon marché restent toujours castables)
// castColor/castBurst/castJitter (2026-07-18, demande explicite : "pense aux animations de sorts
// aussi" / "des effets un peu different pour chaque sort") -- identite visuelle du CAST cote
// personnage (bâton/cristal), lue par witchBodyOn (classes/sorcier/sorcier-render.js) et
// spawnCastOriginVfx (combat/vfx.js). Distincte des VFX d'IMPACT (vfx:'meteor'/'ice'/... déjà
// existants, dessinés sur la cible) -- ici c'est ce qui se voit sur le PERSONNAGE pendant le
// temps de cast, avant que le sort ne parte. castJitter = vitesse du tremblement du bâton
// (relatif, 1 = valeur d'origine) ; plus un sort est rapide à lancer (castT petit), plus son
// tremblement est nerveux, cohérent avec l'impression de rapidité/puissance brute.
const SKILLS = [
  { id:'speed',   name:'Speed Spell',        ic:'✦', cd:26, prio:0, type:'buff', dur:9,  castT:.35, mp:15,
    castColor:'#f0e6c0', castBurst:'shimmer', castJitter:.6 },
  { id:'meteor',  name:'Meteor Shower',      ic:'☄', cd:19, prio:1, dmg:8.5, castT:.85, vfx:'meteor', shake:8, mp:40,
    castColor:'#e8935a', castBurst:'ember', castJitter:.5 },
  { id:'blizzard',name:'Blizzard',           ic:'❄', cd:15, prio:2, dmg:6.8, castT:.7,  vfx:'ice', mp:32,
    castColor:'#9cd6e8', castBurst:'frost', castJitter:.8 },
  { id:'thunder', name:'Thunder Storm',      ic:'⚡', cd:12, prio:3, dmg:5.6, castT:.6,  vfx:'bolt', shake:4, mp:26,
    castColor:'#e8d95a', castBurst:'crackle', castJitter:1.6 },
  { id:'bolide',  name:'Bolide of Destr.',   ic:'✹', cd:10, prio:4, dmg:4.8, castT:.55, vfx:'fire', shake:3, mp:22,
    castColor:'#e8935a', castBurst:'orb', castJitter:1.0 },
  { id:'quake',   name:'Earthquake',         ic:'▲', cd:8,  prio:5, dmg:3.6, castT:.5,  vfx:'quake', shake:6, mp:18,
    castColor:'#a97a4a', castBurst:'dust', castJitter:.7 },
  { id:'lstorm',  name:'Lightning Storm',    ic:'☇', cd:6,  prio:6, dmg:2.9, castT:.45, vfx:'bolt', mp:14,
    castColor:'#f0e880', castBurst:'crackle', castJitter:1.8 },
  { id:'equil',   name:'Equilibrium Break',  ic:'◉', cd:5,  prio:7, dmg:2.2, castT:.4,  vfx:'spark', mp:10,
    castColor:'#b48ce8', castBurst:'flash', castJitter:1.3 },
  { id:'fireball',name:'Fireball Explosion', ic:'●', cd:2.2,prio:8, dmg:1.5, castT:.38, vfx:'fire', mp:6,
    castColor:'#e8935a', castBurst:'orb', castJitter:1.1 },
  { id:'voltaic', name:'Voltaic Pulse',      ic:'∿', cd:1.1,prio:9, dmg:1.0, castT:.32, vfx:'spark', mp:3,
    castColor:'#bfe8f0', castBurst:'flicker', castJitter:2.2 },
];
const MANA_REGEN_PER_SEC = 8; // régén passive, indépendante du combat
const MANA_POTION = { name:{fr:'Potion de mana',en:'Mana Potion'}, cost:110, restore:0.4, cd:4.5 };
const cds = {}; SKILLS.forEach(s => cds[s.id] = 0);
let buffTimer = 0, teleportCd = 0, evasionCd = 0;
