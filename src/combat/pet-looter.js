// ═══ FAMILIER RAMASSEUR (2026-07-19, demande explicite) ═══════════════════════════════════════
// « je veux que le familier récupère ce que le perso fait laisser tomber au sol des monstres, et on
//   peut mettre son loot au même endroit que le perso avec une petite icône pour montrer que c'est
//   le pet qui l'a récup »
//
// Un familier auto-loot dans la scène de combat : il se dirige vers le drop au sol le plus proche
// non pris et le ramasse via collectDrop(l, true) (loot-rolls.js) -- EXACTEMENT le même sac/loot/
// tutoriels que le perso, seul l'affichage (loot ticker + float) est marqué d'une patte 🐾.
//
// Comportement (décision de gameplay validée) : auto-loot EN CONTINU. Le pet complète le perso -- il
// brille surtout en mode XP (où le perso ignore le loot au sol, fsm 'search') et accélère le
// ramassage en mode Loot.
//
// Activation : dès que le joueur possède au moins un compagnon. L'état du module Compagnon est lu
// depuis localStorage['velia_idle_pets_save'] (même origine que l'iframe, cf. save.js) -- relu au
// plus toutes les 2 s, jamais à chaque frame.
//
// Chargement : APRÈS loot-rolls.js (collectDrop) et core/game-core.js (P, S, drops, dist, toScreen,
// ctx, bossState), AVANT/indifféremment de world/render.js (appels au runtime seulement). Les
// intégrations (simTickOnce, drawEntities) sont gardées par typeof pour tolérer l'ordre de charge.

const PET_LOOT_RANGE = 520;      // rayon de recherche d'un drop autour du familier
const PET_PICKUP_RADIUS = 26;    // distance à laquelle il ramasse effectivement
const PET_SPEED = 170;           // vitesse de déplacement (unités/s)
const PET_FOLLOW_DIST = 70;      // distance de flânerie autour du perso au repos
const PET_SNAP_DIST = 900;       // au-delà (téléport / changement de zone), on téléporte le pet près du perso
// couleurs de rareté du module Compagnon (companions.css --r0..--r5) -- petite touche d'identité
const PET_RARITY_HEX = ['#888888','#44b060','#4488cc','#9944cc','#cc8820','#cc3030'];

let Pet = { x:0, y:0, faceX:1, bob:0, active:false, color:'#cc8820', target:null, spawned:false, checkT:0 };

/**
 * Relit (au plus toutes les 2 s) l'état du module Compagnon pour savoir si un familier ramasseur est
 * actif et de quelle couleur (rareté du compagnon le plus rare possédé). 100 % local, même origine.
 * @param {number} dt - delta-temps de la frame (s).
 */
function refreshPetLooterActivation(dt) {
  Pet.checkT -= dt;
  if (Pet.checkT > 0) return;
  Pet.checkT = 2;
  try {
    const raw = localStorage.getItem('velia_idle_pets_save');
    if (!raw) { Pet.active = false; return; }
    const st = JSON.parse(raw);
    const pets = Array.isArray(st.PETS) ? st.PETS : [];
    Pet.active = pets.length > 0;
    if (Pet.active) {
      const bestRar = pets.reduce((m,p)=>Math.max(m, p.rar||0), 0);
      Pet.color = PET_RARITY_HEX[Math.min(PET_RARITY_HEX.length-1, bestRar)] || '#cc8820';
    }
  } catch(e) { Pet.active = false; }
}

/**
 * Tick du familier ramasseur : suit le perso au repos, fonce sur le drop au sol le plus proche et le
 * ramasse (collectDrop(l, true) → même sac/loot que le perso, marqué 🐾). Appelé dans simTickOnce
 * (game-core.js), juste après dropsTick.
 * @param {number} dt - delta-temps de la frame (s).
 */
function petLootTick(dt) {
  refreshPetLooterActivation(dt);
  if (!Pet.active || bossState.active) return;
  // 1re apparition, ou re-synchro après un grand saut du perso (téléport / changement de zone)
  if (!Pet.spawned || dist(Pet.x, Pet.y, P.x, P.y) > PET_SNAP_DIST) {
    Pet.x = P.x - PET_FOLLOW_DIST; Pet.y = P.y; Pet.spawned = true; Pet.target = null;
  }
  Pet.bob += dt*6;

  // cible : le drop au sol le plus proche encore disponible dans le rayon de recherche
  if (!Pet.target || Pet.target.taken) {
    Pet.target = drops.filter(l => !l.taken && dist(Pet.x,Pet.y,l.x,l.y) < PET_LOOT_RANGE)
                      .sort((a,b)=>dist(Pet.x,Pet.y,a.x,a.y)-dist(Pet.x,Pet.y,b.x,b.y))[0] || null;
  }
  const tgt = Pet.target;
  let tx, ty, sp;
  if (tgt) { tx = tgt.x; ty = tgt.y; sp = PET_SPEED; }
  else {
    // au repos : flâne à distance fixe autour du perso (garde sa direction actuelle)
    const ang = Math.atan2(Pet.y - P.y, Pet.x - P.x);
    tx = P.x + Math.cos(ang)*PET_FOLLOW_DIST; ty = P.y + Math.sin(ang)*PET_FOLLOW_DIST; sp = PET_SPEED*0.8;
  }
  const d = dist(Pet.x, Pet.y, tx, ty);
  if (d > 1) {
    const vx = (tx-Pet.x)/d, vy = (ty-Pet.y)/d;
    Pet.x += vx*sp*dt; Pet.y += vy*sp*dt;
    Pet.faceX = vx >= 0 ? 1 : -1;
  }
  // ramassage à portée : même chemin que le perso, marqué familier
  if (tgt && dist(Pet.x,Pet.y,tgt.x,tgt.y) < PET_PICKUP_RADIUS) {
    collectDrop(tgt, true);
    Pet.target = null;
  }
}

/**
 * Dessine le familier ramasseur (petite créature isométrique : corps + oreilles + yeux, colorée à la
 * rareté du meilleur compagnon). Appelé par drawEntities (render.js) quand Pet.active, trié en
 * profondeur avec les autres entités.
 * @param {number} t - timestamp (s).
 */
function drawPetLooterIso(t) {
  if (!Pet.active || !Pet.spawned) return;
  const c = toScreen(Pet.x, Pet.y);
  const bob = Math.sin(Pet.bob)*2;
  ctx.save();
  // ombre au sol
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(c.sx, c.sy+2, 9, 4, 0, 0, 7); ctx.fill();
  // corps
  ctx.fillStyle = Pet.color;
  ctx.beginPath(); ctx.arc(c.sx, c.sy-7+bob, 7, 0, 7); ctx.fill();
  // oreilles
  ctx.beginPath();
  ctx.moveTo(c.sx-6, c.sy-12+bob); ctx.lineTo(c.sx-3, c.sy-18+bob); ctx.lineTo(c.sx-1, c.sy-12+bob);
  ctx.moveTo(c.sx+6, c.sy-12+bob); ctx.lineTo(c.sx+3, c.sy-18+bob); ctx.lineTo(c.sx+1, c.sy-12+bob);
  ctx.fill();
  // yeux (orientés selon faceX)
  ctx.fillStyle = 'rgba(0,0,0,.6)';
  ctx.beginPath();
  ctx.arc(c.sx - 2.6 + Pet.faceX*0.8, c.sy-8+bob, 1.1, 0, 7);
  ctx.arc(c.sx + 2.6 + Pet.faceX*0.8, c.sy-8+bob, 1.1, 0, 7);
  ctx.fill();
  ctx.restore();
}
