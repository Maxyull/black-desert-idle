// ==================== RENDU CANVAS DE LA SALLE DE BOSS ====================
// Extrait de boss.js le 2026-07-08 (reorganisation par dossiers) -- DOIT charger APRES boss.js
// (bossLoop() dans boss.js appelle drawBossRoom(), reference en execution uniquement).
// ===== salle de boss ORIGINALE (art dessiné, aucun asset réel) : salle de pierre à 4 piliers,
// grand seigneur de guerre de la corruption au fond, mécanique d'AoE dont on se protège en se
// plaçant derrière un pilier. Vue de dessus légèrement inclinée. =====
/** @param {number} nx @param {number} ny - coordonnées normalisées [0,1]. @returns {{x:number,y:number}} projection écran dans l'arène de boss. */
function bossProj(nx, ny) { const cv = $('bossCv'); return { x: cv.width*0.5 + (nx-0.5)*cv.width*0.86, y: cv.height*0.10 + ny*cv.height*0.78 }; }
/** @param {CanvasRenderingContext2D} cx @param {number} sx @param {number} sy @param {number} scale. Dessine un pilier de pierre (zone sûre contre l'AoE de Kzarka). */
function drawStonePillar(cx, sx, sy, scale) {
  const w = 34*scale, h = 120*scale;
  cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(sx, sy, w*0.75, w*0.28, 0, 0, 7); cx.fill(); // ombre
  // fût (dégradé pierre)
  const g = cx.createLinearGradient(sx-w/2, 0, sx+w/2, 0);
  g.addColorStop(0,'#2c3238'); g.addColorStop(.45,'#5a636c'); g.addColorStop(.6,'#6d7681'); g.addColorStop(1,'#333940');
  cx.fillStyle = g; cx.fillRect(sx-w/2, sy-h, w, h);
  // chapiteau + base
  cx.fillStyle = '#4b535c'; cx.fillRect(sx-w*0.62, sy-h-8*scale, w*1.24, 10*scale);
  cx.fillRect(sx-w*0.62, sy-6*scale, w*1.24, 8*scale);
  // rainures
  cx.strokeStyle = 'rgba(0,0,0,.25)'; cx.lineWidth = 1;
  for (let i=1;i<4;i++){ const lx=sx-w/2+w*i/4; cx.beginPath(); cx.moveTo(lx,sy-h+6*scale); cx.lineTo(lx,sy-4*scale); cx.stroke(); }
}
/** @param {CanvasRenderingContext2D} cx @param {number} sx @param {number} sy @param {number} r @param {number} t. Dessine Kzarka (Grand Seigneur de guerre) en isométrique. */
function drawWarlord(cx, sx, sy, r, t) {
  cx.save();
  // ombre au sol
  cx.fillStyle='rgba(0,0,0,.45)'; cx.beginPath(); cx.ellipse(sx, sy+r*0.15, r*1.15, r*0.34, 0, 0, 7); cx.fill();
  const glow = 0.5+0.5*Math.sin(t*2);
  // corps massif (carapace corrompue)
  const body = cx.createLinearGradient(sx, sy-r*1.6, sx, sy+r*0.2);
  body.addColorStop(0,'#7a2d33'); body.addColorStop(.5,'#5a2028'); body.addColorStop(1,'#33121a');
  cx.fillStyle = body;
  cx.beginPath();
  cx.moveTo(sx-r*1.1, sy+r*0.1);
  cx.quadraticCurveTo(sx-r*1.35, sy-r*0.9, sx-r*0.5, sy-r*1.15);
  cx.quadraticCurveTo(sx, sy-r*1.5, sx+r*0.5, sy-r*1.15);
  cx.quadraticCurveTo(sx+r*1.35, sy-r*0.9, sx+r*1.1, sy+r*0.1);
  cx.closePath(); cx.fill();
  // pointes de carapace sur le dos
  cx.fillStyle = '#3a161c';
  for (let i=-3;i<=3;i++){ const bx=sx+i*r*0.28, by=sy-r*1.1-Math.abs(i)*r*0.02;
    cx.beginPath(); cx.moveTo(bx-r*0.09,by); cx.lineTo(bx+r*0.09,by); cx.lineTo(bx, by-r*0.4); cx.closePath(); cx.fill(); }
  // fissures de corruption lumineuses
  cx.strokeStyle = `rgba(255,90,70,${0.55+0.35*glow})`; cx.lineWidth = 2; cx.shadowColor='#ff5a46'; cx.shadowBlur=12;
  cx.beginPath();
  cx.moveTo(sx-r*0.5,sy-r*0.9); cx.lineTo(sx-r*0.2,sy-r*0.4); cx.lineTo(sx-r*0.35,sy-r*0.1);
  cx.moveTo(sx+r*0.5,sy-r*0.8); cx.lineTo(sx+r*0.25,sy-r*0.35); cx.lineTo(sx+r*0.4,sy);
  cx.stroke(); cx.shadowBlur=0;
  // bras/griffes
  cx.fillStyle = '#4a1a20';
  cx.beginPath(); cx.moveTo(sx-r*1.0,sy-r*0.5); cx.lineTo(sx-r*1.5,sy-r*0.1); cx.lineTo(sx-r*1.25,sy-r*0.05); cx.lineTo(sx-r*0.9,sy-r*0.3); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(sx+r*1.0,sy-r*0.5); cx.lineTo(sx+r*1.5,sy-r*0.1); cx.lineTo(sx+r*1.25,sy-r*0.05); cx.lineTo(sx+r*0.9,sy-r*0.3); cx.closePath(); cx.fill();
  // tête casquée
  const hy = sy-r*1.05;
  cx.fillStyle = '#43191f'; cx.beginPath(); cx.arc(sx, hy, r*0.42, 0, 7); cx.fill();
  // cornes
  cx.strokeStyle = '#c9b48a'; cx.lineWidth = r*0.16; cx.lineCap='round';
  cx.beginPath(); cx.moveTo(sx-r*0.3, hy-r*0.2); cx.quadraticCurveTo(sx-r*0.75, hy-r*0.7, sx-r*0.55, hy-r*1.0); cx.stroke();
  cx.beginPath(); cx.moveTo(sx+r*0.3, hy-r*0.2); cx.quadraticCurveTo(sx+r*0.75, hy-r*0.7, sx+r*0.55, hy-r*1.0); cx.stroke();
  cx.lineCap='butt';
  // yeux ardents
  cx.fillStyle = `rgba(255,${120+100*glow|0},60,1)`; cx.shadowColor='#ffae3a'; cx.shadowBlur=14;
  cx.beginPath(); cx.arc(sx-r*0.16, hy, r*0.09, 0, 7); cx.fill();
  cx.beginPath(); cx.arc(sx+r*0.16, hy, r*0.09, 0, 7); cx.fill();
  cx.shadowBlur=0;
  cx.restore();
}
// Vell — grand dragon des mers ORIGINAL. Silhouette redessinée le 2026-07-08 (4e version) d'après
// 5 angles d'une sculpture 3D de référence fournie par l'utilisateur, qui clarifient la composition :
// ce ne sont PAS deux cornes séparées d'un socle, mais les DEUX AILES du dragon lui-même, si
// gigantesques qu'elles s'enroulent vers l'intérieur et se rejoignent en bas pour former une grande
// vasque/coupe — le corps du dragon (petit, tête à crête de pointes, museau fin, queue longue et
// fine terminée par une pointe recourbée en lame) est perché tout en haut au centre de cette coupe,
// pattes griffues agrippées au rebord. Franchement différent de Kzarka (humanoïde compact, 2 cornes
// droites, gueule fermée). Pas de reprise d'asset réel, juste l'ambiance/la composition.
/** @param {CanvasRenderingContext2D} cx @param {number} sx @param {number} sy @param {number} r @param {number} t. Dessine Vell (dragon des mers, ailes en vasque). */
function drawVell(cx, sx, sy, r, t) {
  cx.save();
  const glow = 0.5+0.5*Math.sin(t*2);
  const sway = Math.sin(t*0.9)*r*0.02;
  cx.fillStyle='rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(sx, sy+r*0.5, r*1.15, r*0.26, 0, 0, 7); cx.fill();
  // les 2 immenses ailes enroulées en vasque/coupe — élément signature : elles partent des épaules
  // (haut, près de la tête), s'ouvrent largement vers l'extérieur puis se recourbent vers l'intérieur
  // et vers le bas pour se rejoindre au centre, formant une grande coupe qui sert de socle
  const wingBowl = (side) => {
    cx.save(); cx.translate(sx,sy-r*0.75); cx.scale(side,1);
    const wg = cx.createLinearGradient(0,-r*0.2,r*1.15,r*1.1);
    wg.addColorStop(0,'#1c3a4a'); wg.addColorStop(1,'#0a1c26');
    cx.fillStyle = wg;
    cx.beginPath();
    cx.moveTo(r*0.08,-r*0.05);
    cx.quadraticCurveTo(r*0.5,-r*0.2, r*0.85,-r*0.05);
    cx.quadraticCurveTo(r*1.2,r*0.12, r*1.15,r*0.55);
    cx.quadraticCurveTo(r*1.1,r*0.95, r*0.7,r*1.15+sway);
    cx.quadraticCurveTo(r*0.35,r*1.3, r*0.02,r*1.18);
    cx.quadraticCurveTo(r*0.28,r*0.95, r*0.32,r*0.6);
    cx.quadraticCurveTo(r*0.34,r*0.25, r*0.16,r*0.08);
    cx.closePath(); cx.fill();
    // nervures de l'aile
    cx.strokeStyle='rgba(160,220,230,.18)'; cx.lineWidth=r*0.02;
    cx.beginPath(); cx.moveTo(r*0.15,-r*0.02); cx.quadraticCurveTo(r*0.75,r*0.05, r*0.85,r*0.9+sway); cx.stroke();
    cx.beginPath(); cx.moveTo(r*0.15,-r*0.02); cx.quadraticCurveTo(r*0.55,r*0.15, r*0.5,r*0.85); cx.stroke();
    cx.restore();
  };
  wingBowl(-1); wingBowl(1);
  // queue longue et fine, part du corps et longe l'extérieur d'une aile jusqu'à une pointe recourbée
  // en lame — visible qui dépasse sur le côté de la coupe
  cx.strokeStyle='#0e1c24'; cx.lineCap='round';
  cx.beginPath(); cx.lineWidth=r*0.09;
  cx.moveTo(sx-r*0.2,sy-r*0.55);
  cx.quadraticCurveTo(sx-r*0.95,sy-r*0.15+sway, sx-r*1.25,sy+r*0.35);
  cx.stroke();
  cx.lineWidth=r*0.035;
  cx.beginPath(); cx.moveTo(sx-r*1.15,sy+r*0.15); cx.quadraticCurveTo(sx-r*1.4,sy+r*0.3+sway, sx-r*1.42,sy+r*0.55); cx.stroke();
  cx.lineCap='butt';
  // torse : petit corps sombre écaillé perché en haut au centre de la coupe
  const body = cx.createLinearGradient(sx, sy-r*1.35, sx, sy-r*0.4);
  body.addColorStop(0,'#1c3a4a'); body.addColorStop(.6,'#12222c'); body.addColorStop(1,'#0a1620');
  cx.fillStyle = body;
  cx.beginPath();
  cx.moveTo(sx-r*0.24,sy-r*0.45); cx.quadraticCurveTo(sx-r*0.3,sy-r*0.95, sx-r*0.14,sy-r*1.15);
  cx.quadraticCurveTo(sx,sy-r*1.22, sx+r*0.14,sy-r*1.15);
  cx.quadraticCurveTo(sx+r*0.3,sy-r*0.95, sx+r*0.24,sy-r*0.45);
  cx.quadraticCurveTo(sx,sy-r*0.32, sx-r*0.24,sy-r*0.45);
  cx.closePath(); cx.fill();
  // pattes griffues courtes agrippées au rebord de la coupe
  cx.fillStyle = '#12222c';
  for (const side of [-1,1]) {
    cx.beginPath(); cx.ellipse(sx+side*r*0.2,sy-r*0.38,r*0.1,r*0.16,side*0.3,0,7); cx.fill();
    cx.strokeStyle='#e8e2d0'; cx.lineWidth=r*0.02; cx.lineCap='round';
    for (let c=-1;c<=1;c++) { cx.beginPath(); cx.moveTo(sx+side*r*0.19+c*r*0.04,sy-r*0.3); cx.lineTo(sx+side*r*0.16+c*r*0.05,sy-r*0.2); cx.stroke(); }
    cx.lineCap='butt';
  }
  // tête : museau fin, surmontée d'une crête de pointes asymétrique
  const hy = sy-r*1.18;
  cx.fillStyle = '#12222c';
  cx.beginPath(); cx.ellipse(sx,hy,r*0.22,r*0.19,0,0,7); cx.fill();
  cx.beginPath(); cx.ellipse(sx,hy+r*0.15,r*0.13,r*0.11,0,0,7); cx.fill();
  // crête de pointes le long de la nuque/tête — la couronne caractéristique
  cx.fillStyle = '#0e1c24';
  const ridge = [[-0.3,-0.95,0.55],[-0.12,-1.1,0.75],[0.06,-1.15,0.8],[0.24,-1.05,0.65],[0.4,-0.85,0.45]];
  for (const [dx,dy,len] of ridge) {
    const bx=sx+dx*r*0.4, by=hy+dy*r*0.4;
    cx.beginPath();
    cx.moveTo(bx-r*0.035,by); cx.lineTo(bx+dx*r*0.25*len, by+dy*r*0.35*len); cx.lineTo(bx+r*0.035,by);
    cx.closePath(); cx.fill();
  }
  // gueule, crocs, gorge sombre
  cx.fillStyle='#4a0e0e'; cx.beginPath(); cx.ellipse(sx,hy+r*0.18,r*0.13,r*0.1,0,0,Math.PI); cx.fill();
  cx.fillStyle='#e8e2d0';
  for (let i=-2;i<=2;i++) { const tx=sx+i*r*0.05;
    cx.beginPath(); cx.moveTo(tx-r*0.02,hy+r*0.1); cx.lineTo(tx,hy+r*0.21); cx.lineTo(tx+r*0.02,hy+r*0.1); cx.closePath(); cx.fill(); }
  // yeux luminescents, petits et enfoncés
  cx.fillStyle = `rgba(255,${60+40*glow|0},60,1)`; cx.shadowColor='#ff3a3a'; cx.shadowBlur=12;
  cx.beginPath(); cx.arc(sx-r*0.08,hy-r*0.02,r*0.04,0,7); cx.fill();
  cx.beginPath(); cx.arc(sx+r*0.08,hy-r*0.02,r*0.04,0,7); cx.fill();
  cx.shadowBlur=0;
  cx.restore();
}
// dispatcher : chaque boss du roster a sa propre silhouette dans l'arène — pour l'instant Kzarka
// (Grand Seigneur de guerre) et Vell (grand poisson des mers) ont la leur
/** @param {string} bossId. Aiguille vers drawVell ou drawWarlord selon le boss combattu. */
function drawBossCreature(bossId, cx, sx, sy, r, t) {
  if (bossId === 'vell') return drawVell(cx, sx, sy, r, t);
  return drawWarlord(cx, sx, sy, r, t);
}
// bateaux + tirs de canon (2026-07-08, demande explicite : "les joueurs sont autour en bateau et
// lancent des boulets dessus") — dessinés SEULEMENT pour Vell. Réutilise le tableau bs.hits déjà
// généré ~4×/s par bossLoop (chaque hit = un boulet, h.life 1→0 sert de progression de vol).
// bateaux 10× plus gros (demande explicite du 2026-07-08) : repoussés vers les coins bas de l'écran
// pour rester au premier plan sans recouvrir tout le combat malgré leur taille
const VELL_BOATS = [ {x:0.04, y:0.92}, {x:0.96, y:0.92} ];
const VELL_BOAT_SCALE = 13; // 1.3 × 10
// ancres des 2 bateaux (2026-07-08, demande explicite : "les joueurs plongent sous l'ancre des
// bateaux à la place des piliers de Kzarka") — un peu vers le centre par rapport au bateau lui-même,
// pour rester une position atteignable à la nage plutôt que collée au bord de l'écran
const VELL_ANCHORS = [ {x:0.16, y:0.74}, {x:0.84, y:0.74} ];
/** @param {CanvasRenderingContext2D} cx @param {number} sx @param {number} sy @param {number} scale @param {boolean} facingRight. Dessine un des 2 bateaux des joueurs pendant le combat contre Vell. */
function drawVellBoat(cx, sx, sy, scale, facingRight) {
  cx.save(); cx.translate(sx,sy); if (!facingRight) cx.scale(-1,1); cx.scale(scale,scale);
  cx.fillStyle='rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(0,4,26,7,0,0,7); cx.fill();
  cx.fillStyle='#3a2c1e'; // coque
  cx.beginPath(); cx.moveTo(-22,0); cx.quadraticCurveTo(-24,8,-14,9); cx.lineTo(20,9); cx.quadraticCurveTo(26,4,20,0); cx.closePath(); cx.fill();
  cx.strokeStyle='#241a10'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(-20,3); cx.lineTo(18,3); cx.stroke();
  cx.strokeStyle='#5a4630'; cx.lineWidth=1.6; cx.beginPath(); cx.moveTo(-4,0); cx.lineTo(-4,-26); cx.stroke(); // mât
  cx.fillStyle='#c9c2a8'; cx.beginPath(); cx.moveTo(-4,-25); cx.lineTo(12,-16); cx.lineTo(-4,-9); cx.closePath(); cx.fill(); // voile
  cx.restore();
}
/** @param {number} t - timestamp. Rendu complet d'une frame de l'arène de boss (décor Kzarka/Vell, boss, piliers/ancres, autres joueurs, AoE, boulets, vignette réactive aux PV). */
function drawBossRoom(t) {
  const cx = bossCtx, cv = $('bossCv'), W = cv.width, H = cv.height, bs = bossState;
  const isVell = bs.boss === BOSS_ROSTER.vell;
  cx.save();
  // tremblement d'écran (crit / AoE non paré) : léger décalage aléatoire de toute la scène,
  // renforce la sensation d'impact et de profondeur ("4D")
  if (bs.shakeT > 0) cx.translate((Math.random()-0.5)*bs.shakeT, (Math.random()-0.5)*bs.shakeT);
  if (isVell) {
    // Vell : en pleine mer, ciel pâle au loin qui s'assombrit vers l'eau (demande explicite,
    // d'après les captures de référence) — pas de dalles de pierre, juste des rides d'eau
    const sky = cx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#8fb8c9'); sky.addColorStop(.42,'#4a7a8f'); sky.addColorStop(.55,'#1c4a5e'); sky.addColorStop(1,'#0a2430');
    cx.fillStyle = sky; cx.fillRect(0,0,W,H);
    // Vell est cerné de montagnes de tous côtés, UNE SEULE entrée étroite au centre pour aller le
    // voir depuis les bateaux (demande explicite du 2026-07-08, d'après la capture "Barrier Rock" —
    // "il doit y avoir qu'une entrée") : 2 versants rocheux séparés par un unique passage
    const gapL = W*0.40, gapR = W*0.60;
    cx.fillStyle = 'rgba(10,20,26,.6)';
    cx.beginPath(); cx.moveTo(0,H*.5);
    for (let i=0;i<=8;i++) { const x=i/8*gapL; cx.lineTo(x, H*.42 - Math.abs(Math.sin(i*2.3+3))*H*.16); }
    cx.lineTo(gapL,H*.5); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(gapR,H*.5);
    for (let i=0;i<=8;i++) { const x=gapR+i/8*(W-gapR); cx.lineTo(x, H*.42 - Math.abs(Math.sin(i*2.1+11))*H*.16); }
    cx.lineTo(W,H*.5); cx.closePath(); cx.fill();
    // "Barrier Rock" : 2 pointes plus sombres/proches encadrant directement l'entrée
    cx.fillStyle = 'rgba(6,14,18,.75)';
    const rockSpike = (sx, h) => { cx.beginPath(); cx.moveTo(sx-18,H*.58); cx.lineTo(sx,H*.58-h); cx.lineTo(sx+18,H*.58); cx.closePath(); cx.fill(); };
    rockSpike(gapL-10, H*.22);
    rockSpike(gapR+10, H*.24);
    // rides d'eau horizontales, ondulantes
    cx.strokeStyle='rgba(255,255,255,.10)'; cx.lineWidth=1;
    for (let i=0;i<9;i++) { const y = H*.5 + i*(H*.5/9);
      cx.beginPath();
      for (let x=0;x<=W;x+=24) cx.lineTo(x, y+Math.sin(x*0.03+t*1.2+i)*3);
      cx.stroke();
    }
  } else {
    // fond : grande salle brumeuse bleu-gris
    const bg = cx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#1a2830'); bg.addColorStop(.55,'#223038'); bg.addColorStop(1,'#10171c');
    cx.fillStyle = bg; cx.fillRect(0,0,W,H);
    // dalles de pierre au sol (bandes qui s'élargissent vers le bas = légère perspective)
    cx.strokeStyle = 'rgba(0,0,0,.28)'; cx.lineWidth = 1;
    for (let i=0;i<=10;i++){ const p=bossProj(0,i/10); cx.beginPath(); cx.moveTo(0,p.y); cx.lineTo(W,p.y); cx.stroke(); }
    for (let i=0;i<=8;i++){ const top=bossProj(i/8,0), bot=bossProj(i/8,1); cx.beginPath(); cx.moveTo(top.x,top.y); cx.lineTo(bot.x,bot.y); cx.stroke(); }
  }
  // brume de fond en parallaxe : dérive LENTE et indépendante du tremblement d'écran — donne au
  // donjon une vraie impression de profondeur/volume ("4D") au-delà du simple décor plat
  const fogDrift = Math.sin(t*0.15)*16;
  const fog = cx.createRadialGradient(W/2+fogDrift, H*0.32, W*0.08, W/2+fogDrift, H*0.32, W*0.8);
  fog.addColorStop(0,'rgba(255,255,255,0)'); fog.addColorStop(1,`rgba(0,0,0,${isVell?.22:.4})`);
  cx.fillStyle = fog; cx.fillRect(0,0,W,H);
  if (isVell) { // bateaux des joueurs, de part et d'autre — demande explicite du 2026-07-08
    drawVellBoat(cx, W*VELL_BOATS[0].x, H*VELL_BOATS[0].y, VELL_BOAT_SCALE, true);
    drawVellBoat(cx, W*VELL_BOATS[1].x, H*VELL_BOATS[1].y, VELL_BOAT_SCALE, false);
  }
  // braises de corruption en arrière-plan (profondeur : plus loin = plus petit/lent/transparent)
  for (const e of bs.embers) {
    if (e.depth > 0.6) continue; // couche lointaine, DERRIÈRE le boss
    const ex = (e.x + Math.sin(e.sway)*0.01)*W, ey = e.y*H;
    cx.globalAlpha = e.life*0.35*e.depth; cx.fillStyle = '#ff8a4a'; cx.shadowColor='#ff5a2a'; cx.shadowBlur = 6;
    cx.beginPath(); cx.arc(ex, ey, 1+1.5*e.depth, 0, 7); cx.fill();
  }
  cx.globalAlpha = 1; cx.shadowBlur = 0;
  // boss au fond : légère oscillation de volume (skew) pour donner une impression de masse en 3D
  const bpos = bossProj(0.5, 0.12); const r = Math.min(W,H)*0.14;
  cx.save();
  cx.translate(bpos.x, bpos.y);
  cx.transform(1, 0, 0.05*Math.sin(t*0.6), 1+0.015*Math.sin(t*1.3), 0, 0);
  drawBossCreature(bs.bossId, cx, 0, 0, r, t);
  cx.restore();
  // braises au premier plan (devant le boss, plus grosses/rapides/opaques)
  for (const e of bs.embers) {
    if (e.depth <= 0.6) continue;
    const ex = (e.x + Math.sin(e.sway)*0.015)*W, ey = e.y*H;
    cx.globalAlpha = e.life*0.55*e.depth; cx.fillStyle = '#ffb066'; cx.shadowColor='#ff5a2a'; cx.shadowBlur = 8;
    cx.beginPath(); cx.arc(ex, ey, 1.5+2*e.depth, 0, 7); cx.fill();
  }
  cx.globalAlpha = 1; cx.shadowBlur = 0;
  // boulets de canon tirés des bateaux (Vell uniquement) : chaque hit = 1 boulet, h.life 1→0 sert de
  // progression de vol (le bateau tire du côté le plus proche de x du hit) — demande explicite :
  // "affiche ça, l'animation de boulet ... avec un tic à chaque boulet"
  if (isVell) {
    for (const h of bs.hits) {
      const boat = VELL_BOATS[h.x < 0.5 ? 0 : 1];
      const bx = W*boat.x, by = H*boat.y - VELL_BOAT_SCALE*12; // départ du boulet à hauteur du pont, proportionnel à la taille du bateau
      const prog = 1-h.life; // 0 au départ du bateau, 1 à l'impact
      const px = bx + (bpos.x-bx)*prog;
      const py = by + (bpos.y-by)*prog - Math.sin(prog*Math.PI)*70; // arc parabolique
      cx.fillStyle = '#1a1a1a';
      cx.beginPath(); cx.arc(px, py, 4.5, 0, 7); cx.fill();
      cx.strokeStyle = 'rgba(200,200,200,.4)'; cx.lineWidth = 1.5;
      cx.beginPath(); cx.moveTo(px,py); cx.lineTo(px-(bpos.x-bx)*0.05, py-(bpos.y-by)*0.05+8); cx.stroke();
    }
  }
  // impacts de dégâts sur le boss
  for (const h of bs.hits) {
    const hy = bpos.y - (1-h.life)*40;
    cx.globalAlpha = Math.max(0,h.life);
    cx.font = h.crit?'bold 24px Georgia':'18px Georgia'; cx.textAlign='center';
    cx.fillStyle = h.crit?'#ffbe78':'#fff';
    cx.fillText('-'+fmt(Math.ceil(h.dmg))+(h.crit?'!':''), bpos.x+(h.x-.5)*r*2.4, hy);
    cx.globalAlpha = 1;
  }
  cx.textAlign='left';
  // ---- AoE au sol : cercle qui grandit (telegraph) puis explosion, sauf derrière les piliers —
  // pour Vell (2026-07-08), reskin "vague" bleu/écume : le joueur doit PLONGER au lieu de se cacher
  // derrière un pilier, mais le mécanisme sûr/pas-sûr sous-jacent reste identique
  const aoeCol = isVell ? [90,180,220] : [224,70,60];
  if (bs.aoePhase==='telegraph' || bs.aoePhase==='blast') {
    const c = bossProj(0.5, 0.6);
    const rad = Math.min(W,H)*0.55;
    if (bs.aoePhase==='telegraph') {
      const prog = Math.min(1, bs.aoeT/2.2);
      cx.fillStyle = `rgba(${aoeCol[0]},${aoeCol[1]},${aoeCol[2]},${0.10+0.14*prog})`;
      cx.beginPath(); cx.ellipse(c.x, c.y, rad, rad*0.55, 0, 0, 7); cx.fill();
      cx.strokeStyle = `rgba(${isVell?'160,220,255':'255,80,60'},${0.5+0.4*Math.sin(t*10)})`; cx.lineWidth = 3;
      cx.beginPath(); cx.ellipse(c.x, c.y, rad*prog, rad*0.55*prog, 0, 0, 7); cx.stroke();
    } else {
      const a = 1-Math.min(1,bs.aoeT/0.45);
      cx.fillStyle = `rgba(${isVell?'160,220,255':'255,90,60'},${0.55*a})`;
      cx.beginPath(); cx.ellipse(c.x, c.y, rad, rad*0.55, 0, 0, 7); cx.fill();
    }
    // zones sûres (pilier en pierre, ou bouée de plongée pour Vell) — petite ombre bleutée = "à couvert"
    for (const p of bs.pillars) { const s = bossProj(p.x, p.y+0.05);
      cx.fillStyle = 'rgba(120,180,255,.16)'; cx.beginPath(); cx.ellipse(s.x, s.y, 40, 16, 0, 0, 7); cx.fill(); }
  }
  // ---- éléments au sol triés par profondeur (piliers/ancres + héros) pour un rendu cohérent
  const drawables = bs.pillars.map((p,pi) => ({ ny:p.y, fn:()=>{
    const s = bossProj(p.x,p.y);
    if (isVell) {
      // ancre du bateau le plus proche : chaîne qui descend du pont jusqu'à la surface, où l'on
      // plonge pour se mettre à l'abri — demande explicite du 2026-07-08 ("plonge sous l'ancre des
      // bateaux à la place des anciens piliers de Kzarka")
      const boat = VELL_BOATS[pi] || VELL_BOATS[0];
      const bx = W*boat.x, by = H*boat.y - VELL_BOAT_SCALE*12;
      cx.strokeStyle='rgba(90,90,90,.55)'; cx.lineWidth=2;
      cx.beginPath(); cx.moveTo(bx,by); cx.lineTo(s.x,s.y-14); cx.stroke();
      cx.fillStyle='rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(s.x,s.y+2,12,4.5,0,0,7); cx.fill();
      cx.strokeStyle='#7a7a78'; cx.lineWidth=2.4; cx.lineCap='round';
      cx.beginPath(); cx.moveTo(s.x,s.y-14); cx.lineTo(s.x,s.y-2); cx.stroke(); // tige de l'ancre
      cx.beginPath(); cx.arc(s.x,s.y-14,3,0,7); cx.stroke(); // anneau du haut
      cx.beginPath(); cx.arc(s.x,s.y-3,6,Math.PI*0.15,Math.PI*0.85); cx.stroke(); // courbe des pattes
      cx.beginPath(); cx.moveTo(s.x-6,s.y-3); cx.lineTo(s.x-9,s.y-8); cx.moveTo(s.x+6,s.y-3); cx.lineTo(s.x+9,s.y-8); cx.stroke(); // pattes
      cx.beginPath(); cx.moveTo(s.x-9,s.y-13); cx.lineTo(s.x+9,s.y-13); cx.stroke(); // barre transversale
    } else drawStonePillar(cx, s.x, s.y, Math.min(W,H)/500*1.6);
  } }));
  // Vell (2026-07-08, demande explicite "fais plonger le personnage") : quand on s'abrite près
  // d'une bouée pendant la charge, le héros disparaît sous l'eau (ridules + bulles) au lieu de
  // rester debout comme si de rien n'était — bien plus lisible que le simple bouclier bleu.
  const dodgingNow = bs.aoePhase==='telegraph' || bs.aoePhase==='blast';
  const nearBuoy = isVell && bs.pillars.some(p => Math.hypot(p.x-bs.px, p.y-bs.py) < 0.10 && bs.py > p.y);
  const diving = isVell && dodgingNow && nearBuoy;
  drawables.push({ ny:bs.py, fn:()=>{
    const s = bossProj(bs.px, bs.py);
    if (diving) {
      // ridules concentriques qui s'élargissent + bulles qui remontent, à la surface où il a plongé
      cx.strokeStyle='rgba(200,230,255,.5)'; cx.lineWidth=1.4;
      for (let i=0;i<3;i++) { const rr = 6+((t*30+i*9)%22);
        cx.globalAlpha = Math.max(0,1-rr/22); cx.beginPath(); cx.ellipse(s.x,s.y,rr,rr*0.4,0,0,7); cx.stroke(); }
      cx.globalAlpha = 1;
      cx.fillStyle='rgba(220,240,255,.6)';
      for (let i=0;i<4;i++) { const bx=s.x+Math.sin(t*3+i*2)*8, by=s.y-((t*18+i*7)%20);
        cx.beginPath(); cx.arc(bx,by,1.4+i*0.3,0,7); cx.fill(); }
      return;
    }
    cx.fillStyle='rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(s.x, s.y, 12, 5, 0, 0, 7); cx.fill();
    // bouclier si paré
    if (bs.blockFlash>0) { cx.strokeStyle=`rgba(140,200,255,${bs.blockFlash})`; cx.lineWidth=3; cx.beginPath(); cx.arc(s.x, s.y-18, 20, 0, 7); cx.stroke(); }
    const hurt = bs.hurtFlash>0;
    cx.fillStyle = hurt ? '#c0554533' : '#3b6ea8';
    cx.beginPath(); cx.moveTo(s.x, s.y-36); cx.lineTo(s.x-10, s.y); cx.lineTo(s.x+10, s.y); cx.closePath(); cx.fill();
    cx.fillStyle = hurt ? '#e0a0a0' : '#e8d0a0'; cx.beginPath(); cx.arc(s.x, s.y-38, 5.5, 0, 7); cx.fill();
    cx.fillStyle = '#2a4a7a'; cx.beginPath(); cx.moveTo(s.x-7,s.y-38); cx.lineTo(s.x+7,s.y-38); cx.lineTo(s.x,s.y-50); cx.closePath(); cx.fill();
  }});
  // ---- les AUTRES joueurs du boss partagé, en direct via Supabase Realtime presence (voir
  // joinBossChannel) : silhouette simplifiée + pseudo, à leur position réelle dans l'arène —
  // demande explicite : "tous les joueurs doivent se voir dans la zone du boss"
  if (bs.shared) {
    for (const uid in otherFighters) {
      const f = otherFighters[uid];
      if (!f || typeof f.px !== 'number' || typeof f.py !== 'number') continue;
      const p = otherFightersPos[uid] || { x:f.px, y:f.py }; // position lissée (voir bossLoop), repli sur la brute si pas encore initialisée
      drawables.push({ ny:p.y, fn:()=>{
        const s = bossProj(p.x, p.y);
        cx.fillStyle='rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(s.x, s.y, 10, 4, 0, 0, 7); cx.fill();
        cx.fillStyle = '#5a8a4a';
        cx.beginPath(); cx.moveTo(s.x, s.y-30); cx.lineTo(s.x-8, s.y); cx.lineTo(s.x+8, s.y); cx.closePath(); cx.fill();
        cx.fillStyle = '#d8c89a'; cx.beginPath(); cx.arc(s.x, s.y-32, 4.5, 0, 7); cx.fill();
        cx.font = '10px Georgia'; cx.textAlign = 'center'; cx.fillStyle = '#cde8c0';
        cx.shadowColor = '#000'; cx.shadowBlur = 3;
        cx.fillText((f.pseudo||'?').slice(0,14), s.x, s.y-40);
        cx.shadowBlur = 0;
      }});
    }
  }
  drawables.sort((a,b)=>a.ny-b.ny).forEach(d => d.fn());
  // messages flottants (PARÉ / AoE) au-dessus du héros
  for (const m of bs.floatMsgs) {
    const s = bossProj(bs.px, bs.py);
    cx.globalAlpha = Math.max(0, Math.min(1, m.life));
    cx.font = 'bold 18px Georgia'; cx.textAlign='center'; cx.fillStyle = m.color;
    cx.fillText(m.txt, s.x, s.y-56-(1-m.life)*24);
    cx.globalAlpha = 1;
  }
  cx.textAlign='left'; cx.textBaseline='alphabetic';
  // vignette réactive aux PV du boss : le donjon "respire" la corruption à mesure qu'il faiblit —
  // renforce encore l'immersion "4D" en réagissant à l'état réel du combat, pas juste au décor
  const hpFrac = bs.maxHp > 0 ? Math.max(0, bs.hp/bs.maxHp) : 1;
  const breathe = 1 + Math.sin(t*2.2)*(hpFrac<0.3?0.18:0.05);
  const vigStrength = (0.14 + (1-hpFrac)*0.36) * breathe;
  const vig = cx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.78);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,`rgba(140,20,20,${Math.min(0.6,vigStrength)})`);
  cx.fillStyle = vig; cx.fillRect(0,0,W,H);
  cx.restore(); // referme le cx.save() du tremblement d'écran en tout début de fonction
}
