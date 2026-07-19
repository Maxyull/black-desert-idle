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

const PET_FOLLOW_DIST = 70;      // distance de flânerie autour du perso au repos
const PET_SNAP_DIST = 900;       // au-delà (téléport / changement de zone), on téléporte le pet près du perso
// valeurs de repli (pet sans stats lisibles) -- normalement remplacées par les stats du pet Collecte
const PET_BASE_SPEED = 170, PET_BASE_RANGE = 520, PET_BASE_PICKUP = 26;
// couleurs de rareté du module Compagnon (companions.css --r0..--r5) -- petite touche d'identité
const PET_RARITY_HEX = ['#888888','#44b060','#4488cc','#9944cc','#cc8820','#cc3030'];

// speed/range/pickupR sont pilotés par les stats du pet Collecte actif (voir refreshPetLooterActivation)
let Pet = { x:0, y:0, faceX:1, bob:0, active:false, color:'#cc8820', target:null, spawned:false, checkT:0,
            speed:PET_BASE_SPEED, range:PET_BASE_RANGE, pickupR:PET_BASE_PICKUP };

/**
 * Relit (au plus toutes les 2 s) l'état du module Compagnon pour désigner le familier RAMASSEUR et
 * calibrer son comportement (2026-07-19, précision : "les pet looter ont des stats, c'est les pet
 * collecte"). Le ramasseur est un pet de la catégorie « Collecte » (cat.sec==='loot') -- priorité au
 * pet DÉPLOYÉ sur le terrain Collecte, sinon le meilleur Collecte possédé. Ses stats pilotent :
 *   stats[0] = « Vitesse collecte » → vitesse de déplacement ; stats[1] = « Rayon » → portée de
 * recherche + de ramassage (voir catalog.js, section 'loot'.sk). Échelle × tierMult (tier.js). Sans
 * aucun pet Collecte, pas de ramasseur en combat. 100 % local, même origine que l'iframe.
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
    // uniquement les pets de la catégorie Collecte : eux seuls ont des stats de ramassage utiles
    const collectors = pets.filter(p => p && p.cat && p.cat.sec === 'loot' && Array.isArray(p.stats));
    if (!collectors.length) { Pet.active = false; return; }
    // « puissance de collecte » = (vitesse + rayon) × tierMult ; le pet déployé passe devant
    const power = p => (((p.stats[0]||0) + (p.stats[1]||0)) * (p.tierMult || 1)) + (p.terrain ? 1e6 : 0);
    const best = collectors.reduce((a,b) => power(b) > power(a) ? b : a);
    const mult = best.tierMult || 1;
    const vit = best.stats[0] || 0;   // Vitesse collecte
    const ray = best.stats[1] || 0;   // Rayon
    Pet.active  = true;
    Pet.color   = PET_RARITY_HEX[Math.min(PET_RARITY_HEX.length-1, best.rar||0)] || '#cc8820';
    Pet.speed   = 150 + vit * mult * 1.2;
    Pet.range   = 360 + ray * mult * 6;
    Pet.pickupR = 22  + ray * mult * 0.4;
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

  // cible : le drop au sol le plus proche encore disponible dans le rayon de recherche (stat Rayon)
  if (!Pet.target || Pet.target.taken) {
    Pet.target = drops.filter(l => !l.taken && dist(Pet.x,Pet.y,l.x,l.y) < Pet.range)
                      .sort((a,b)=>dist(Pet.x,Pet.y,a.x,a.y)-dist(Pet.x,Pet.y,b.x,b.y))[0] || null;
  }
  const tgt = Pet.target;
  let tx, ty, sp;
  if (tgt) { tx = tgt.x; ty = tgt.y; sp = Pet.speed; }          // stat Vitesse collecte
  else {
    // au repos : flâne à distance fixe autour du perso (garde sa direction actuelle)
    const ang = Math.atan2(Pet.y - P.y, Pet.x - P.x);
    tx = P.x + Math.cos(ang)*PET_FOLLOW_DIST; ty = P.y + Math.sin(ang)*PET_FOLLOW_DIST; sp = Pet.speed*0.8;
  }
  const d = dist(Pet.x, Pet.y, tx, ty);
  if (d > 1) {
    const vx = (tx-Pet.x)/d, vy = (ty-Pet.y)/d;
    Pet.x += vx*sp*dt; Pet.y += vy*sp*dt;
    Pet.faceX = vx >= 0 ? 1 : -1;
  }
  // ramassage à portée (stat Rayon) : même chemin que le perso, marqué familier
  if (tgt && dist(Pet.x,Pet.y,tgt.x,tgt.y) < Pet.pickupR) {
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
