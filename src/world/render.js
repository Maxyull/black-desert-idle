// ==================== RENDU ====================
// BUG trouvé le 2026-07-07 : le mélange final utilisait un décalage ARITHMÉTIQUE (h>>16), dont le
// bit de signe recopié annulait systématiquement le bit 31 dans le XOR (signe ^ signe = 0) — la
// fonction ne pouvait donc JAMAIS dépasser 0.5. Conséquence silencieuse depuis toujours : aucun
// seuil de décor (rochers .965, buissons .90, touffes .78, cases "dry" .93) n'était jamais atteint,
// les zones de combat n'avaient AUCUN décor. Corrigé avec un décalage non signé (h>>>16).
/** @param {number} ix @param {number} iy - coordonnées de tuile. @returns {number} pseudo-hash déterministe dans [0,1) (décalage NON signé >>> requis, voir commentaire ci-dessus). */
function hash2(ix,iy){ let h=ix*374761393+iy*668265263; h=(h^(h>>13))*1274126177; return ((h^(h>>>16))>>>0)/4294967295; }

// Velia (zone paisible) a son propre décor chaleureux de village — pas de réutilisation du
// thème de la dernière zone de combat farmée, demande explicite du 2026-07-05
const VELIA_TINT = { a:'#6a5842', b:'#5f4d38', dry:'#7a6650' };
/** Dessine le sol en damier isométrique (tuiles visibles autour de la caméra), teinté selon la zone active (ou VELIA_TINT à Velia). */
function drawGround() {
  const tint = atVelia ? VELIA_TINT : Z().tint;
  ctx.fillStyle = tint.b;
  ctx.fillRect(0,0,W,H);
  const TILE = 46;
  const cx0 = Math.floor((cam.x-700)/TILE), cx1 = Math.ceil((cam.x+700)/TILE);
  const cy0 = Math.floor((cam.y-700)/TILE), cy1 = Math.ceil((cam.y+700)/TILE);
  for (let ix=cx0; ix<=cx1; ix++)
    for (let iy=cy0; iy<=cy1; iy++) {
      const x=ix*TILE, y=iy*TILE;
      const a=toScreen(x,y);
      if (a.sx<-TILE*2||a.sx>W+TILE*2||a.sy<-TILE*2||a.sy>H+TILE*2) continue;
      const h = hash2(ix,iy);
      ctx.fillStyle = (ix+iy)%2===0 ? tint.a : tint.b;
      if (h > .93) ctx.fillStyle = tint.dry;
      const b=toScreen(x+TILE,y), c2=toScreen(x+TILE,y+TILE), d=toScreen(x,y+TILE);
      ctx.beginPath();
      ctx.moveTo(a.sx,a.sy); ctx.lineTo(b.sx,b.sy); ctx.lineTo(c2.sx,c2.sy); ctx.lineTo(d.sx,d.sy);
      ctx.closePath(); ctx.fill();
    }
}

/** @param {number} ix @param {number} iy. @returns {object|null} décor de zone de combat standard à cette tuile (rock/bush/tuft) selon hash2, ou null. */
function sceneryAt(ix,iy) {
  const h = hash2(ix*7+3, iy*7+11);
  if (h > .965) return { kind:'rock', x:ix*46+23, y:iy*46+23 };
  if (h > .90)  return { kind:'bush', x:ix*46+23, y:iy*46+23 };
  if (h > .78)  return { kind:'tuft', x:ix*46+23, y:iy*46+23 };
  return null;
}

// décor propre à la Mine de Fer Abandonnée (zone 6) : carrière ocre inspirée des captures de
// référence du 2026-07-07 — tours de guet en bois, pitons rocheux (petites montagnes), chariots de
// minerai cassés, crevasses dans la terre. Pas de buissons verts : terrain aride, éboulis partout.
/** @param {number} ix @param {number} iy. @returns {object|null} décor propre à la Mine de Fer Abandonnée (tour/spire/chariot/crevasse/rocher/galets), ou null. */
function mineSceneryAt(ix,iy) {
  const h = hash2(ix*7+3, iy*7+11);
  if (h > .988) return { kind:'tower',    x:ix*46+23, y:iy*46+23 };
  if (h > .975) return { kind:'spire',    x:ix*46+23, y:iy*46+23 };
  if (h > .962) return { kind:'cart',     x:ix*46+23, y:iy*46+23 };
  if (h > .935) return { kind:'crevasse', x:ix*46+23, y:iy*46+23 };
  if (h > .86)  return { kind:'rock',     x:ix*46+23, y:iy*46+23 };
  if (h > .76)  return { kind:'pebbles',  x:ix*46+23, y:iy*46+23 };
  return null;
}

// décor du village de Velia (zone paisible) : maisons/puits/lampadaires disposés sur une grille
// régulière plutôt que le placement aléatoire des zones de combat, pour un vrai ressenti de village
/** @param {number} ix @param {number} iy. @returns {object|null} décor du village de Velia (maison/puits/lampadaire sur grille régulière + buissons épars), ou null. */
function veliaSceneryAt(ix,iy) {
  const gx = ((ix%6)+6)%6, gy = ((iy%6)+6)%6;
  if (gx===0 && gy===0) return { kind:'house', x:ix*46+23, y:iy*46+23 };
  if (gx===3 && gy===3) return { kind:'well',  x:ix*46+23, y:iy*46+23 };
  if (gx===0 && gy===3) return { kind:'lamp',  x:ix*46+23, y:iy*46+23 };
  if (gx===3 && gy===0) return { kind:'lamp',  x:ix*46+23, y:iy*46+23 };
  const h = hash2(ix*7+3, iy*7+11);
  if (h > .9) return { kind:'bush', x:ix*46+23, y:iy*46+23 };
  return null;
}

/** @param {number} t - timestamp. Trie et dessine toutes les entités visibles (décor, cadavres, drops, loups, personnage, particules) par profondeur isométrique (x+y). */
function drawEntities(t) {
  const items = [];
  const TILE = 46;
  const cx0 = Math.floor((cam.x-700)/TILE), cx1 = Math.ceil((cam.x+700)/TILE);
  const cy0 = Math.floor((cam.y-700)/TILE), cy1 = Math.ceil((cam.y+700)/TILE);
  for (let ix=cx0; ix<=cx1; ix++)
    for (let iy=cy0; iy<=cy1; iy++) {
      const sc = atVelia ? veliaSceneryAt(ix,iy) : (zoneIdx === 6 ? mineSceneryAt(ix,iy) : sceneryAt(ix,iy));
      // les crevasses sont des marques PLATES dans le sol : dessinées tout de suite après le
      // terrain (profondeur minimale), jamais par-dessus un monstre ou le personnage
      if (sc) items.push({ depth: sc.kind==='crevasse' ? -1e9 : sc.x+sc.y, fn:()=>drawScenery(sc) });
    }
  corpses.forEach(c => items.push({ depth:c.x+c.y-1, fn:()=>drawCorpse(c) }));
  drops.forEach(l => { if (!l.taken) items.push({ depth:l.x+l.y-1, fn:()=>drawDrop(l,t) }); });
  packs.forEach(p => {
    if (p.dead) return;
    p.wolves.forEach(w => {
      if (w.dead) return; // déjà tué individuellement (2026-07-11) -- retiré de l'affichage
      const wp = wolfPos(p,w);
      items.push({ depth:wp.x+wp.y, fn:()=>drawMonsterIso(wp.x,wp.y,w,t) });
      items.push({ depth:wp.x+wp.y+1, fn:()=>drawWolfHpBar(p,w) });
    });
  });
  items.push({ depth:P.x+P.y, fn:()=>drawWitchIso(t) });
  particles.forEach(q => items.push({ depth:(q.x??P.x)+(q.y??P.y)+30, fn:()=>drawParticle(q) }));
  items.sort((a,b)=>a.depth-b.depth);
  items.forEach(i=>i.fn());
}

/** @param {object} sc - décor (voir sceneryAt/mineSceneryAt/veliaSceneryAt). Dessine cet élément de décor à l'écran (culling hors viewport). */
function drawScenery(sc) {
  const c = toScreen(sc.x,sc.y);
  if (c.sx<-40||c.sx>W+40||c.sy<-40||c.sy>H+40) return;
  if (sc.kind==='rock') {
    ctx.fillStyle='rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,10,4,0,0,7); ctx.fill();
    ctx.fillStyle='#6a6a66';
    ctx.beginPath(); ctx.moveTo(c.sx-9,c.sy); ctx.lineTo(c.sx-3,c.sy-9); ctx.lineTo(c.sx+6,c.sy-7); ctx.lineTo(c.sx+9,c.sy); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#7d7d78';
    ctx.beginPath(); ctx.moveTo(c.sx-3,c.sy-9); ctx.lineTo(c.sx+6,c.sy-7); ctx.lineTo(c.sx+2,c.sy-2); ctx.closePath(); ctx.fill();
  } else if (sc.kind==='bush') {
    ctx.fillStyle='rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,11,4,0,0,7); ctx.fill();
    ctx.fillStyle='#2c4426';
    ctx.beginPath(); ctx.arc(c.sx-5,c.sy-5,6,0,7); ctx.arc(c.sx+4,c.sy-6,7,0,7); ctx.arc(c.sx,c.sy-2,6,0,7); ctx.fill();
  } else if (sc.kind==='house') {
    // petite maison de village : socle ombré + mur clair + mur d'ombre + toit à 2 pans + porte
    ctx.fillStyle='rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,20,7,0,0,7); ctx.fill();
    ctx.fillStyle='#c9b48a';
    ctx.fillRect(c.sx-14,c.sy-17,28,17);
    ctx.fillStyle='#a8926a';
    ctx.fillRect(c.sx-14,c.sy-17,9,17);
    ctx.fillStyle='#a8402e';
    ctx.beginPath(); ctx.moveTo(c.sx-17,c.sy-17); ctx.lineTo(c.sx,c.sy-32); ctx.lineTo(c.sx+17,c.sy-17); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#8a3324';
    ctx.beginPath(); ctx.moveTo(c.sx,c.sy-32); ctx.lineTo(c.sx+17,c.sy-17); ctx.lineTo(c.sx+9,c.sy-17); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#4a3320';
    ctx.fillRect(c.sx-3,c.sy-9,6,9);
    ctx.fillStyle='#6a4a2e';
    ctx.fillRect(c.sx+5,c.sy-14,4,4);
  } else if (sc.kind==='well') {
    ctx.fillStyle='rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,10,4,0,0,7); ctx.fill();
    ctx.fillStyle='#8a8276';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy-2,9,4.4,0,0,7); ctx.fill();
    ctx.strokeStyle='#5f574c'; ctx.lineWidth=1.3;
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy-2,9,4.4,0,0,7); ctx.stroke();
    ctx.strokeStyle='#4a4238'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.moveTo(c.sx-8,c.sy-2); ctx.lineTo(c.sx-8,c.sy-15); ctx.moveTo(c.sx+8,c.sy-2); ctx.lineTo(c.sx+8,c.sy-15); ctx.stroke();
    ctx.fillStyle='#6a4a2e'; ctx.fillRect(c.sx-9,c.sy-17,18,3);
  } else if (sc.kind==='lamp') {
    ctx.fillStyle='rgba(0,0,0,.2)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+1,4,2,0,0,7); ctx.fill();
    ctx.strokeStyle='#3a3a38'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(c.sx,c.sy); ctx.lineTo(c.sx,c.sy-20); ctx.stroke();
    ctx.fillStyle='#e6c96a';
    ctx.beginPath(); ctx.arc(c.sx,c.sy-22,3.4,0,7); ctx.fill();
    ctx.fillStyle='rgba(230,201,106,.25)';
    ctx.beginPath(); ctx.arc(c.sx,c.sy-22,7,0,7); ctx.fill();
  } else if (sc.kind==='tower') {
    // tour de guet en bois (Mine de Fer) : 4 pieds croisés + plateforme + toit pointu à débord
    ctx.fillStyle='rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,16,6,0,0,7); ctx.fill();
    ctx.strokeStyle='#4a3a28'; ctx.lineWidth=2.2;
    ctx.beginPath();
    ctx.moveTo(c.sx-11,c.sy); ctx.lineTo(c.sx-6,c.sy-34);
    ctx.moveTo(c.sx+11,c.sy); ctx.lineTo(c.sx+6,c.sy-34);
    ctx.moveTo(c.sx-10,c.sy-8); ctx.lineTo(c.sx+10,c.sy-16); // croisillons
    ctx.moveTo(c.sx+10,c.sy-8); ctx.lineTo(c.sx-10,c.sy-16);
    ctx.stroke();
    ctx.fillStyle='#6a4a2e'; // plateforme
    ctx.fillRect(c.sx-10,c.sy-37,20,4);
    ctx.fillStyle='#5a3e26'; // garde-corps
    ctx.fillRect(c.sx-10,c.sy-43,2,6); ctx.fillRect(c.sx+8,c.sy-43,2,6);
    ctx.fillStyle='#3e4a38'; // toit pointu à débord (feuillage/chaume sombre)
    ctx.beginPath(); ctx.moveTo(c.sx-14,c.sy-43); ctx.lineTo(c.sx,c.sy-54); ctx.lineTo(c.sx+14,c.sy-43); ctx.closePath(); ctx.fill();
  } else if (sc.kind==='spire') {
    // piton rocheux / petite montagne ocre à strates
    ctx.fillStyle='rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,20,7,0,0,7); ctx.fill();
    ctx.fillStyle='#6e4a34';
    ctx.beginPath();
    ctx.moveTo(c.sx-18,c.sy); ctx.lineTo(c.sx-10,c.sy-22); ctx.lineTo(c.sx-4,c.sy-40);
    ctx.lineTo(c.sx+3,c.sy-31); ctx.lineTo(c.sx+12,c.sy-18); ctx.lineTo(c.sx+18,c.sy); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#845a40'; // face éclairée
    ctx.beginPath();
    ctx.moveTo(c.sx-4,c.sy-40); ctx.lineTo(c.sx+3,c.sy-31); ctx.lineTo(c.sx+12,c.sy-18); ctx.lineTo(c.sx+6,c.sy); ctx.lineTo(c.sx-1,c.sy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(40,24,16,.4)'; ctx.lineWidth=1; // strates
    ctx.beginPath();
    ctx.moveTo(c.sx-13,c.sy-12); ctx.lineTo(c.sx+14,c.sy-10);
    ctx.moveTo(c.sx-9,c.sy-22); ctx.lineTo(c.sx+10,c.sy-20);
    ctx.stroke();
  } else if (sc.kind==='cart') {
    // chariot de minerai cassé : caisse penchée, roue à rayons détachée, planches au sol
    ctx.fillStyle='rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,15,5,0,0,7); ctx.fill();
    ctx.save(); ctx.translate(c.sx,c.sy); ctx.rotate(-0.12); // caisse penchée (essieu cassé)
    ctx.fillStyle='#5a4430'; ctx.fillRect(-11,-13,20,9);
    ctx.fillStyle='#6e563c'; ctx.fillRect(-11,-13,20,3);
    ctx.strokeStyle='#3e2f20'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-5,-13); ctx.lineTo(-5,-4); ctx.moveTo(2,-13); ctx.lineTo(2,-4); ctx.stroke();
    ctx.fillStyle='#4e5258'; // tas de minerai qui déborde
    ctx.beginPath(); ctx.arc(-4,-14,3,0,7); ctx.arc(1,-15,2.6,0,7); ctx.arc(5,-13.6,2.4,0,7); ctx.fill();
    ctx.restore();
    // roue à rayons détachée, posée contre la caisse
    ctx.strokeStyle='#4a3a28'; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.ellipse(c.sx+13,c.sy-5,4.8,6,0.25,0,7); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c.sx+9.5,c.sy-8.5); ctx.lineTo(c.sx+16.5,c.sy-1.5);
    ctx.moveTo(c.sx+16,c.sy-9); ctx.lineTo(c.sx+10,c.sy-1);
    ctx.stroke();
    ctx.strokeStyle='#5a4430'; ctx.lineWidth=1.6; // planche cassée au sol
    ctx.beginPath(); ctx.moveTo(c.sx-16,c.sy+1); ctx.lineTo(c.sx-7,c.sy+4); ctx.stroke();
  } else if (sc.kind==='crevasse') {
    // crevasse : fissure sombre PLATE dans la terre (dessinée juste après le sol, voir drawEntities)
    ctx.save(); ctx.translate(c.sx,c.sy); ctx.rotate(hash2(sc.x,sc.y)*Math.PI);
    ctx.scale(1,.5); // écrasée pour suivre la perspective iso du sol
    ctx.fillStyle='rgba(18,10,7,.75)';
    ctx.beginPath();
    ctx.moveTo(-24,0); ctx.quadraticCurveTo(-10,-5, 2,-2); ctx.quadraticCurveTo(14,1, 24,-1);
    ctx.quadraticCurveTo(12,5, -2,3); ctx.quadraticCurveTo(-14,1, -24,0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(90,54,36,.5)'; ctx.lineWidth=1.2; // lèvre éclairée de la fissure
    ctx.beginPath(); ctx.moveTo(-22,-1); ctx.quadraticCurveTo(-8,-6, 4,-3); ctx.stroke();
    ctx.restore();
  } else if (sc.kind==='pebbles') {
    // éboulis : quelques cailloux ocre
    ctx.fillStyle='#6e5540';
    ctx.beginPath(); ctx.arc(c.sx-4,c.sy,2.2,0,7); ctx.fill();
    ctx.fillStyle='#7e6450';
    ctx.beginPath(); ctx.arc(c.sx+3,c.sy-1,1.7,0,7); ctx.fill();
    ctx.fillStyle='#5e4836';
    ctx.beginPath(); ctx.arc(c.sx,c.sy+3,1.4,0,7); ctx.fill();
  } else {
    ctx.strokeStyle='#57683c'; ctx.lineWidth=1.4;
    ctx.beginPath();
    ctx.moveTo(c.sx,c.sy); ctx.lineTo(c.sx-3,c.sy-7);
    ctx.moveTo(c.sx,c.sy); ctx.lineTo(c.sx+1,c.sy-8);
    ctx.moveTo(c.sx,c.sy); ctx.lineTo(c.sx+4,c.sy-6);
    ctx.stroke();
  }
}

/** @param {object} l - loot au sol. @param {number} t - timestamp. Dessine le loot au sol (forme/couleur selon l.item.kind), bobbing + clignotement avant despawn. */
function drawDrop(l,t) {
  const c = toScreen(l.x,l.y);
  if (c.sx<-30||c.sx>W+30||c.sy<-30||c.sy>H+30) return;
  if (l.age > DESPAWN-8 && Math.sin(t*10) > 0) return;
  const pop = 1 + l.pop*2.4;
  const bob = Math.sin(t*3+l.x)*1.5;
  ctx.fillStyle='rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,6,2.4,0,0,7); ctx.fill();
  const k = l.item.kind;
  if (k==='jackpot') {
    ctx.fillStyle='rgba(232,184,74,.3)';
    ctx.beginPath(); ctx.arc(c.sx,c.sy-6+bob,10+Math.sin(t*5)*2,0,7); ctx.fill();
    ctx.fillStyle=l.item.color;
    ctx.beginPath(); ctx.arc(c.sx,c.sy-6+bob,4.2*pop,0,7); ctx.fill();
    ctx.strokeStyle='#fff8'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(c.sx,c.sy-6+bob,4.2*pop,0,7); ctx.stroke();
  } else if (k==='craft') {
    ctx.fillStyle='rgba(180,140,232,.28)';
    ctx.beginPath(); ctx.arc(c.sx,c.sy-6+bob,9+Math.sin(t*5)*2,0,7); ctx.fill();
    ctx.fillStyle=l.item.color;
    ctx.save(); ctx.translate(c.sx,c.sy-6+bob); ctx.rotate(t*1.5);
    ctx.fillRect(-3.4*pop,-3.4*pop,6.8*pop,6.8*pop); ctx.restore();
  } else if (k==='material') {
    ctx.fillStyle=l.item.color;
    ctx.save(); ctx.translate(c.sx,c.sy-4+bob);
    ctx.beginPath(); ctx.moveTo(0,-4*pop); ctx.lineTo(3.5*pop,0); ctx.lineTo(0,4*pop); ctx.lineTo(-3.5*pop,0); ctx.closePath(); ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle=l.item.color;
    ctx.save(); ctx.translate(c.sx,c.sy-4+bob); ctx.rotate(.6);
    ctx.fillRect(-4*pop,-2.4*pop,8*pop,4.8*pop); ctx.restore();
  }
}

/** @param {object} cp - cadavre (fondu progressif via cp.life). Dessine le cadavre d'un monstre vaincu. */
function drawCorpse(cp) {
  const c = toScreen(cp.x,cp.y);
  ctx.save(); ctx.globalAlpha = Math.min(1,cp.life/1.2)*.8;
  ctx.fillStyle = cp.tone;
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy,15*cp.scale,6*cp.scale,.3,0,7); ctx.fill();
  ctx.restore();
}

/** @param {number} wx @param {number} wy - position monde. @param {object} w - instance de monstre. @param {number} t - timestamp. Dessine un loup en isométrique. */
/** @param {number} wx @param {number} wy - position monde. @param {object} w - instance de monstre. @param {number} t - timestamp. Dessine un loup en isométrique (zone 1 uniquement). Silhouette enrichie le 2026-07-23 (demande explicite : "modifier [les monstres] qu'il ressemble à quelque chose") -- contour net, pelage à 2 tons (dos plus sombre / ventre plus clair, mêmes teintes que w.tone, aucune nouvelle couleur ajoutée), touffes de crinière, queue en volume -- même squelette de dessin (jambes/tête/oreilles) et même animation (trot/lunge) qu'avant, purement procédural (pas de sprite). */
function drawWolfIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  ctx.fillStyle='rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,15*w.scale,5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  const trot = Math.sin(t*7+w.phase)*2;
  if (w.lunge > .3) { ctx.strokeStyle='rgba(220,80,60,.55)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-12,18,11,0,0,7); ctx.stroke(); }
  ctx.fillStyle=w.tone; ctx.strokeStyle=w.tone; ctx.lineWidth=3.2; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-10,-6); ctx.lineTo(-11,2+trot*.4);
  ctx.moveTo(-4,-6); ctx.lineTo(-4,2-trot*.4);
  ctx.moveTo(6,-6); ctx.lineTo(6,2+trot*.3);
  ctx.moveTo(11,-6); ctx.lineTo(12,2-trot*.3);
  ctx.stroke();
  // pattes : petite patte ovale au sol (au lieu d'un trait qui s'arrête net) + ombre de contact
  ctx.fillStyle=w.tone;
  [[-11,2+trot*.4],[-4,2-trot*.4],[6,2+trot*.3],[12,2-trot*.3]].forEach(([px,py]) => {
    ctx.beginPath(); ctx.ellipse(px,py,2.3,1.3,0,0,7); ctx.fill();
  });
  ctx.fillStyle='rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(-10.5,1,1.8,1,0,0,7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-4,1,1.8,1,0,0,7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6,1,1.8,1,0,0,7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(11.5,1,1.8,1,0,0,7); ctx.fill();
  // queue en volume : 2 formes qui se chevauchent au lieu d'un simple trait -- lit toujours w.tone,
  // aucune couleur nouvelle, juste plus de matière visuelle
  ctx.fillStyle=w.tone;
  ctx.beginPath(); ctx.moveTo(-14,-12); ctx.quadraticCurveTo(-22,-15+trot,-25,-10+trot);
  ctx.quadraticCurveTo(-20,-9+trot,-14,-9); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-16,-14); ctx.quadraticCurveTo(-24,-17+trot*.6,-27,-12+trot*.6);
  ctx.quadraticCurveTo(-21,-13+trot*.6,-16,-12); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0,-11,15,7.5,-.06,0,7); ctx.fill();
  // ventre plus clair (sous-partie du corps) -- 2e ton via superposition translucide claire,
  // pas une nouvelle couleur en dur
  ctx.fillStyle='rgba(255,255,255,.14)';
  ctx.beginPath(); ctx.ellipse(0,-6.5,12,4,-.06,0,Math.PI); ctx.fill();
  ctx.fillStyle=w.tone;
  ctx.beginPath(); ctx.ellipse(9,-10,7,6.4,.2,0,7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(17,-17+trot*.2,6.4,5,.15,0,7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(21,-18); ctx.lineTo(27,-15.6); ctx.lineTo(21,-14); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13,-22); ctx.lineTo(15,-27); ctx.lineTo(17.5,-21.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(17,-22); ctx.lineTo(19.6,-26.4); ctx.lineTo(21,-21); ctx.closePath(); ctx.fill();
  // museau : petite truffe sombre en bout de gueule, plus de "visage" qu'un simple ovale
  ctx.fillStyle='rgba(0,0,0,.55)';
  ctx.beginPath(); ctx.ellipse(22.6,-16.4+trot*.2,1.3,1,.15,0,7); ctx.fill();
  // oreilles : coquille interne plus sombre (léger relief, même logique de superposition translucide)
  ctx.fillStyle='rgba(0,0,0,.25)';
  ctx.beginPath(); ctx.moveTo(14,-23); ctx.lineTo(15.4,-25.6); ctx.lineTo(16.7,-22.2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(17.6,-23); ctx.lineTo(19.3,-25.5); ctx.lineTo(20.2,-22.4); ctx.closePath(); ctx.fill();
  // touffes de crinière : élargies de la nuque à la base de la queue (2026-07-23, "dans le style
  // plus détaillé") -- silhouette bien moins lisse qu'une simple ellipse, sans changer les proportions
  ctx.fillStyle='rgba(0,0,0,.18)';
  [[-12,-15.5],[-8,-18],[-2,-19.5],[4,-19],[9,-17]].forEach(([tx,ty]) => {
    ctx.beginPath(); ctx.moveTo(tx-2,ty+3); ctx.lineTo(tx,ty); ctx.lineTo(tx+2,ty+3); ctx.closePath(); ctx.fill();
  });
  // collerette de poitrail (sous le menton/cou) -- même logique de touffes, densifie la silhouette
  // vers l'avant du corps pour équilibrer les touffes de dos
  ctx.fillStyle='rgba(0,0,0,.15)';
  [[10,-6],[13,-7.5],[16,-9]].forEach(([tx,ty]) => {
    ctx.beginPath(); ctx.moveTo(tx-1.6,ty+2.4); ctx.lineTo(tx,ty); ctx.lineTo(tx+1.6,ty+2.4); ctx.closePath(); ctx.fill();
  });
  // quelques traits de fourrure sur le flanc -- texture légère, jamais assez marquée pour lire
  // comme un motif/tache, juste de la matière (mêmes principes que la robe de la sorcière : accents
  // fins plutôt qu'une nouvelle forme)
  ctx.strokeStyle='rgba(0,0,0,.14)'; ctx.lineWidth=.7; ctx.lineCap='round';
  [[-6,-14,-3,-10],[0,-15,3,-11],[-9,-11,-6,-8]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  });
  // contour net (2026-07-23, "modifier les monstres qu'il ressemble à quelque chose") : léger
  // liseré sombre sur le corps/tête pour une silhouette plus lisible, comme le reskin sorcière
  ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=.9;
  ctx.beginPath(); ctx.ellipse(0,-11,15,7.5,-.06,0,7); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(9,-10,7,6.4,.2,0,7); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(17,-17+trot*.2,6.4,5,.15,0,7); ctx.stroke();
  ctx.fillStyle = w.lunge>.3 ? '#e05540' : '#e8c25a';
  ctx.beginPath(); ctx.arc(17.5,-18+trot*.2,1.2,0,7); ctx.fill();
  ctx.restore();
}
// Esprit de Protty (zone "Ruines de Protty") — créature ORIGINALE inspirée d'un mollusque/poisson
// fantomatique flottant (dôme façon coquille, frange de nageoires, silhouette évasive), demande
// explicite du 2026-07-07 ("modélise les Protty") — aucun asset réel repris, juste l'ambiance.
/** @param {number} wx @param {number} wy - position monde. @param {object} w - instance de monstre. @param {number} t - timestamp. Dessine un Protty en isométrique. */
/** @param {number} wx @param {number} wy - position monde. @param {object} w - instance de monstre. @param {number} t - timestamp. Dessine un Esprit de Protty en isométrique (zone "Ruines de Protty"). Silhouette enrichie le 2026-07-23 (demande explicite, ambiance uniquement -- captures/concept art fournis en référence, "aucun asset réel repris" reste vrai, voir commentaire ci-dessous) -- halo bioluminescent permanent (pas seulement pendant le lunge), mouchetures lumineuses sur le dôme, nageoires du sommet plus larges façon aile de mite avec tache sombre, tentacules frangés sous le ventre, contour net -- même flottement/lunge qu'avant, purement procédural (pas de sprite). */
function drawProttyIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  const bob = Math.sin(t*2+w.phase)*2.2; // flotte doucement (créature évasive, pas de trot au sol)
  ctx.fillStyle='rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,13*w.scale,5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3+bob);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  // halo bioluminescent permanent, discret au repos et net pendant le lunge -- même teinte que
  // la frange (pas de nouvelle couleur), juste toujours un peu présent au lieu d'apparaître d'un coup
  ctx.strokeStyle = w.lunge>.3 ? 'rgba(120,210,180,.55)' : 'rgba(120,210,180,.22)';
  ctx.lineWidth = w.lunge>.3 ? 2 : 1.2;
  ctx.beginPath(); ctx.ellipse(0,-13,17,11,0,0,7); ctx.stroke();
  const tone = w.tone;
  // dôme/coquille (moitié supérieure d'une ellipse)
  ctx.fillStyle = tone;
  ctx.beginPath(); ctx.ellipse(0,-14,14,13,0,Math.PI,0,true); ctx.fill();
  // mouchetures lumineuses sur le dôme -- étoiles bioluminescentes fixes (pas animées, juste
  // un semis de points), même esprit que la carapace mouchetée des références d'ambiance
  ctx.fillStyle='rgba(230,250,240,.75)';
  [[-8,-19,.7],[-3,-22,.55],[4,-21,.65],[8,-17,.5],[-5,-15,.5],[2,-16,.6]].forEach(([dx,dy,r]) => {
    ctx.beginPath(); ctx.arc(dx,dy,r,0,7); ctx.fill();
  });
  // sous-ventre pâle, translucide
  ctx.fillStyle='rgba(216,205,184,.92)';
  ctx.beginPath(); ctx.ellipse(0,-6,10.5,7,0,0,Math.PI); ctx.fill();
  // tentacules frangés sous le ventre -- ondulent doucement, ajoutent de la matière évasive sous
  // la coquille (inspiré de l'ambiance des références, pas un asset copié)
  ctx.strokeStyle='rgba(216,205,184,.7)'; ctx.lineWidth=1.6; ctx.lineCap='round';
  [[-6,0],[0,.6],[6,1.2]].forEach(([dx,ph]) => {
    const sway = Math.sin(t*2.2+w.phase+ph)*2;
    ctx.beginPath(); ctx.moveTo(dx,-2); ctx.quadraticCurveTo(dx+sway,3,dx+sway*1.4,8); ctx.stroke();
  });
  // frange de nageoires du sommet, élargie façon aile de mite avec une tache sombre (2026-07-23,
  // "dans le style plus détaillé", ambiance des références) -- garde le même balancement qu'avant
  [[-9,0],[-3,1],[3,1],[9,0]].forEach(([dx,ph],i) => {
    const sway = Math.sin(t*3+w.phase+ph)*1.6;
    ctx.fillStyle='#c9d86a';
    ctx.beginPath(); ctx.moveTo(dx-1.6,-21.5); ctx.lineTo(dx+sway,-30-Math.abs(sway)*.35); ctx.lineTo(dx+4.4,-21); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(60,80,50,.4)';
    ctx.beginPath(); ctx.ellipse(dx+sway*.5+1,-26,1.3,1.8,0,0,7); ctx.fill();
  });
  // nageoires latérales (façon poisson)
  ctx.fillStyle = tone;
  ctx.beginPath(); ctx.moveTo(-13,-13); ctx.lineTo(-21,-9+Math.sin(t*4+w.phase)*2); ctx.lineTo(-12,-6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13,-13); ctx.lineTo(21,-9-Math.sin(t*4+w.phase)*2); ctx.lineTo(12,-6); ctx.closePath(); ctx.fill();
  // contour net (même logique que sorcière/loup) : liseré sombre sur le dôme pour une silhouette
  // plus lisible
  ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=.9;
  ctx.beginPath(); ctx.ellipse(0,-14,14,13,0,Math.PI,0,true); ctx.stroke();
  // petit oeil sombre
  ctx.fillStyle = w.lunge>.3 ? '#e05540' : '#2a2420';
  ctx.beginPath(); ctx.arc(4.5,-11,1.5,0,7); ctx.fill();
  ctx.restore();
}
// Pirate (zone "Repaire des Pirates", juste après Ruines de Protty) — créature ORIGINALE
// humanoïde : bandana, barbe, gilet ouvert sur le torse, lame en main. Demande explicite du
// 2026-07-07 ("les pirates juste après Protty") — aucun asset réel repris, juste l'ambiance.
/** @param {number} wx @param {number} wy - position monde. @param {object} w - instance de monstre. @param {number} t - timestamp. Dessine un pirate en isométrique. */
function drawPirateIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  ctx.fillStyle='rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,11*w.scale,4.5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  const trot = Math.sin(t*6+w.phase)*1.4; // léger balancement de marche
  if (w.lunge > .3) { ctx.strokeStyle='rgba(220,80,60,.55)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-16,14,10,0,0,7); ctx.stroke(); }
  const tone = w.tone; // teinte du gilet, variété par zone (comme les autres monstres)
  // jambes
  ctx.strokeStyle='#3a3228'; ctx.lineWidth=3.4; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-3,-8); ctx.lineTo(-4,3+trot*.5);
  ctx.moveTo(3,-8); ctx.lineTo(4,3-trot*.5);
  ctx.stroke();
  // torse / gilet
  ctx.fillStyle = tone;
  ctx.beginPath(); ctx.moveTo(-7,-9); ctx.lineTo(-6,-24); ctx.lineTo(6,-24); ctx.lineTo(7,-9); ctx.closePath(); ctx.fill();
  // torse nu au centre (gilet ouvert)
  ctx.fillStyle='#c9a074';
  ctx.beginPath(); ctx.moveTo(-2.4,-23); ctx.lineTo(-2,-10); ctx.lineTo(2,-10); ctx.lineTo(2.4,-23); ctx.closePath(); ctx.fill();
  // bras armé + lame (avance en cas d'attaque)
  ctx.strokeStyle = tone; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(6,-22); ctx.lineTo(11+lungeAmt*.4,-14); ctx.stroke();
  ctx.strokeStyle='#c9ccd2'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(11+lungeAmt*.4,-14); ctx.lineTo(17+lungeAmt*.6,-20); ctx.stroke();
  // tête (peau)
  ctx.fillStyle='#c9a074';
  ctx.beginPath(); ctx.arc(0,-28,4.4,0,7); ctx.fill();
  // barbe
  ctx.fillStyle='#241d16';
  ctx.beginPath(); ctx.arc(0,-25.5,3.6,0.15,Math.PI-0.15); ctx.fill();
  // bandana + pan noué derrière
  ctx.fillStyle = w.lunge>.3 ? '#c05545' : '#a03a2e';
  ctx.beginPath(); ctx.arc(0,-30,4.6,Math.PI,0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(3.6,-29); ctx.lineTo(7,-27); ctx.lineTo(3.2,-26.4); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// Guerrier Rhutum (zone "Camp Rhutum", juste après le Repaire des Pirates) — créature ORIGINALE :
// humanoïde massif à peau verte, crâne rasé à crête de plumes/piquants, bouc tressé, torse épais et
// bras noueux. Demande explicite du 2026-07-07 ("camp de ruthum... avec ce que je t'envoie comme
// screen") — inspiré de l'ambiance des images de référence (guerrier/archer orc), aucun asset réel repris.
/** @param {number} wx @param {number} wy - position monde. @param {object} w - instance de monstre. @param {number} t - timestamp. Dessine un Rhutum en isométrique. */
function drawRhutumIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,12.5*w.scale,5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  const trot = Math.sin(t*5.5+w.phase)*1.6; // démarche lourde
  if (w.lunge > .3) { ctx.strokeStyle='rgba(120,200,110,.5)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-17,15,11,0,0,7); ctx.stroke(); }
  const strap = w.tone; // teinte des sangles/pagne en cuir, variété par zone (comme les autres monstres)
  const skin = '#7a9a52';
  // jambes épaisses
  ctx.strokeStyle='#3e3226'; ctx.lineWidth=4.4; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-4,-9); ctx.lineTo(-5,3+trot*.5);
  ctx.moveTo(4,-9); ctx.lineTo(5,3-trot*.5);
  ctx.stroke();
  // torse massif (peau)
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.moveTo(-9,-9); ctx.lineTo(-8,-26); ctx.lineTo(8,-26); ctx.lineTo(9,-9); ctx.closePath(); ctx.fill();
  // sangle/pagne en cuir sur le torse (teinte de zone)
  ctx.strokeStyle = strap; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-7,-24); ctx.lineTo(6,-11); ctx.stroke();
  // bras noueux + arme (avance en cas d'attaque)
  ctx.strokeStyle = skin; ctx.lineWidth=4.2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(8,-23); ctx.lineTo(13+lungeAmt*.45,-13); ctx.stroke();
  ctx.strokeStyle='#8a8378'; ctx.lineWidth=2.4;
  ctx.beginPath(); ctx.moveTo(13+lungeAmt*.45,-13); ctx.lineTo(20+lungeAmt*.7,-19); ctx.stroke();
  // tête (peau verte)
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0,-30,5,0,7); ctx.fill();
  // mâchoire proéminente + bouc tressé
  ctx.fillStyle='#241d16';
  ctx.beginPath(); ctx.arc(0,-27,3.4,0.1,Math.PI-0.1); ctx.fill();
  // défenses
  ctx.fillStyle='#e8e2d0';
  ctx.beginPath(); ctx.moveTo(-2.6,-26.5); ctx.lineTo(-3.2,-24); ctx.lineTo(-1.6,-25); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2.6,-26.5); ctx.lineTo(3.2,-24); ctx.lineTo(1.6,-25); ctx.closePath(); ctx.fill();
  // crête de plumes/piquants sur le crâne (rouge, comme les images de référence)
  ctx.fillStyle = w.lunge>.3 ? '#c8503a' : '#a8402c';
  for (let i=-1; i<=1; i++) {
    ctx.beginPath();
    ctx.moveTo(i*2.4,-34); ctx.lineTo(i*2.4-0.9,-40-Math.abs(i)*2); ctx.lineTo(i*2.4+0.9,-34); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
// Garde Shultz (zone "Ferme Shultz", juste après le Camp Rhutum) — créature ORIGINALE : garde
// humain lourdement blindé, casque à cimier empanaché, épaulières massives, bouc/moustache blanche,
// arme lourde brandie au-dessus de la tête. Demande explicite du 2026-07-07 ("Shultz aide toi des
// screen") — inspiré de l'ambiance des captures (garde de camp BDO en armure complète), aucun
// asset réel repris.
/** @param {number} wx @param {number} wy - position monde. @param {object} w - instance de monstre. @param {number} t - timestamp. Dessine un Shultz en isométrique. */
function drawShultzIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,12*w.scale,5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  const trot = Math.sin(t*5+w.phase)*1.2; // démarche lourde, blindée
  if (w.lunge > .3) { ctx.strokeStyle='rgba(200,190,140,.5)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-17,15,11,0,0,7); ctx.stroke(); }
  const plate = w.tone; // teinte des plaques d'armure, variété par zone (comme les autres monstres)
  // jambières
  ctx.strokeStyle='#2c2a26'; ctx.lineWidth=4.6; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-4,-9); ctx.lineTo(-5,3+trot*.4);
  ctx.moveTo(4,-9); ctx.lineTo(5,3-trot*.4);
  ctx.stroke();
  // torse blindé (plastron)
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.moveTo(-9,-9); ctx.lineTo(-8,-25); ctx.lineTo(8,-25); ctx.lineTo(9,-9); ctx.closePath(); ctx.fill();
  // liseré doré sur le plastron
  ctx.strokeStyle='#c9a55a'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(-7,-12); ctx.lineTo(7,-12); ctx.stroke();
  // épaulières massives
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.ellipse(-9,-23,4,3.4,0,0,7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(9,-23,4,3.4,0,0,7); ctx.fill();
  // bras + arme lourde brandie au-dessus de la tête (descend un peu lors de l'attaque)
  ctx.strokeStyle='#8a7a5a'; ctx.lineWidth=3.6; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(7,-22); ctx.lineTo(10,-30+lungeAmt*.3); ctx.stroke();
  ctx.strokeStyle='#9ba0a8'; ctx.lineWidth=2.6;
  ctx.beginPath(); ctx.moveTo(10,-30+lungeAmt*.3); ctx.lineTo(9,-41+lungeAmt*.5); ctx.stroke();
  ctx.fillStyle='#c9ccd2';
  ctx.beginPath(); ctx.moveTo(6,-40); ctx.lineTo(9,-46); ctx.lineTo(12,-40); ctx.closePath(); ctx.fill();
  // tête (peau) + moustache/bouc blanc
  ctx.fillStyle='#c9a074';
  ctx.beginPath(); ctx.arc(0,-29,4.6,0,7); ctx.fill();
  ctx.fillStyle='#d8d2c4';
  ctx.beginPath(); ctx.arc(0,-26,3.6,0.1,Math.PI-0.1); ctx.fill();
  // casque à cimier (plaque + empanachement)
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.arc(0,-31,4.9,Math.PI,0); ctx.fill();
  ctx.fillStyle = w.lunge>.3 ? '#c8503a' : '#a8402c';
  ctx.beginPath(); ctx.moveTo(-1.4,-35); ctx.lineTo(0,-43); ctx.lineTo(1.4,-35); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// Combattant Sausan (zone "Colonie Sausan", juste après la Ferme Shultz) — créature ORIGINALE :
// guerrier des sables en cotte de mailles, capuche pointue rabattue et voile de tissu masquant le
// bas du visage, longue tunique/pan qui flotte. Demande explicite du 2026-07-07 ("Fais moi les
// sausans") — inspiré de l'ambiance des captures (soldats encapuchonnés en mailles, désert), aucun
// asset réel repris. Volontairement distinct du Garde Shultz (plaques + casque à cimier) : ici,
// mailles souples + capuche + voile.
/** @param {number} wx @param {number} wy - position monde. @param {object} w - instance de monstre. @param {number} t - timestamp. Dessine un Sausan en isométrique. */
function drawSausanIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  ctx.fillStyle='rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,11*w.scale,4.5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  const trot = Math.sin(t*5.5+w.phase)*1.3;
  const sway = Math.sin(t*3+w.phase)*1.1; // le pan de tunique flotte
  if (w.lunge > .3) { ctx.strokeStyle='rgba(210,190,140,.5)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-16,14,10,0,0,7); ctx.stroke(); }
  const cloth = w.tone; // teinte de la tunique/mailles, variété par zone (comme les autres monstres)
  // jambes
  ctx.strokeStyle='#3a352c'; ctx.lineWidth=3.4; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-3,-8); ctx.lineTo(-4,3+trot*.5);
  ctx.moveTo(3,-8); ctx.lineTo(4,3-trot*.5);
  ctx.stroke();
  // longue tunique en cotte de mailles (s'évase vers le bas, avec un pan qui flotte)
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-7,-9); ctx.lineTo(-6,-24); ctx.lineTo(6,-24); ctx.lineTo(7,-9);
  ctx.lineTo(5+sway,-2); ctx.lineTo(-5+sway,-2); ctx.closePath(); ctx.fill();
  // texture de mailles (petits reflets)
  ctx.strokeStyle='rgba(230,230,240,.18)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(-5,-20); ctx.lineTo(5,-20); ctx.moveTo(-5,-15); ctx.lineTo(5,-15); ctx.moveTo(-5,-10); ctx.lineTo(5,-10); ctx.stroke();
  // ceinture
  ctx.strokeStyle='#5a4632'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-6,-12); ctx.lineTo(6,-12); ctx.stroke();
  // bras armé + lame courbe (cimeterre) qui avance en attaque
  ctx.strokeStyle = cloth; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(6,-21); ctx.lineTo(11+lungeAmt*.4,-15); ctx.stroke();
  ctx.strokeStyle='#c9ccd2'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(11+lungeAmt*.4,-15); ctx.quadraticCurveTo(17+lungeAmt*.6,-18, 16+lungeAmt*.6,-24); ctx.stroke();
  // tête voilée (bas du visage en tissu)
  ctx.fillStyle='#b8a382';
  ctx.beginPath(); ctx.arc(0,-28,4.2,0,7); ctx.fill();
  ctx.fillStyle = cloth; // voile de tissu sur le bas du visage
  ctx.beginPath(); ctx.arc(0,-26.5,3.9,0.1,Math.PI-0.1); ctx.fill();
  // fente des yeux (ombre)
  ctx.strokeStyle='rgba(20,16,10,.8)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(-2.4,-29); ctx.lineTo(2.4,-29); ctx.stroke();
  // capuche pointue rabattue par-dessus la tête
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-5,-28); ctx.quadraticCurveTo(-5.5,-35, 0,-37.5);
  ctx.quadraticCurveTo(5.5,-35, 5,-28);
  ctx.quadraticCurveTo(0,-31, -5,-28); ctx.closePath(); ctx.fill();
  // pointe de la capuche
  ctx.beginPath(); ctx.moveTo(0,-37.5); ctx.lineTo(-1.6,-34); ctx.lineTo(1.6,-34); ctx.closePath(); ctx.fill();
  ctx.restore();
}
// Mineur corrompu (zone "Mine de Fer Abandonnée", juste après la Colonie Sausan) — créatures
// ORIGINALES, demande explicite du 2026-07-07 avec captures de référence (carrière ocre, mineurs
// encapuchonnés, brutes blindées à pointes près des chariots) — aucun asset réel repris :
//  - mob normal : mineur voûté encapuchonné, tunique poussiéreuse, pioche à l'épaule
//  - boss de pack (w.alpha, 1 pack sur 2 dans cette zone) : contremaître massif en armure de fer
//    bardée de pointes, épaulières rondes cloutées, masse énorme — silhouette bien plus large
/** @param {number} wx @param {number} wy - position monde. @param {object} w - instance de monstre. @param {number} t - timestamp. Dessine un mineur en isométrique. */
function drawMineurIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  ctx.fillStyle='rgba(0,0,0,.3)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,(w.alpha?14:10.5)*w.scale,(w.alpha?5.5:4.5),0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  const trot = Math.sin(t*(w.alpha?4.5:6)+w.phase)*(w.alpha?1.1:1.4);
  if (w.lunge > .3) { ctx.strokeStyle='rgba(200,120,80,.55)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-16,w.alpha?17:14,w.alpha?12:10,0,0,7); ctx.stroke(); }
  const tone = w.tone;
  if (w.alpha) {
    // ---- contremaître blindé (boss de pack) ----
    // jambes blindées écartées
    ctx.strokeStyle='#2e3238'; ctx.lineWidth=5; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(-5,-8); ctx.lineTo(-6.5,3+trot*.4);
    ctx.moveTo(5,-8); ctx.lineTo(6.5,3-trot*.4);
    ctx.stroke();
    // corps rond massif en fer (dos voûté vers l'avant)
    ctx.fillStyle = tone;
    ctx.beginPath(); ctx.ellipse(0,-17,10.5,9.5,0,0,7); ctx.fill();
    // reflets de plaques
    ctx.strokeStyle='rgba(220,228,240,.22)'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.ellipse(0,-17,7.5,6.5,0,Math.PI*1.15,Math.PI*1.85); ctx.stroke();
    // pointes sur le dos et les épaules (comme la brute des captures)
    ctx.fillStyle='#3a3e44';
    for (const [px,py,ang] of [[-8,-23,-2.3],[-3,-26,-1.85],[3,-26,-1.3],[8,-23,-0.85]]) {
      ctx.save(); ctx.translate(px,py); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(-1.6,0); ctx.lineTo(0,-5.5); ctx.lineTo(1.6,0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // épaulière ronde cloutée côté arme
    ctx.fillStyle='#4a5058';
    ctx.beginPath(); ctx.arc(9,-22,4.6,0,7); ctx.fill();
    ctx.fillStyle='#22262c';
    ctx.beginPath(); ctx.arc(9,-22,1.6,0,7); ctx.fill();
    // bras + masse énorme (s'abat lors de l'attaque)
    ctx.strokeStyle='#2e3238'; ctx.lineWidth=4.4; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(10,-20); ctx.lineTo(15+lungeAmt*.5,-12); ctx.stroke();
    ctx.strokeStyle='#5a4a38'; ctx.lineWidth=2.6;
    ctx.beginPath(); ctx.moveTo(15+lungeAmt*.5,-12); ctx.lineTo(21+lungeAmt*.7,-22); ctx.stroke();
    ctx.fillStyle='#6a7078';
    ctx.beginPath(); ctx.ellipse(21+lungeAmt*.7,-24,3.6,4.6,0.3,0,7); ctx.fill();
    ctx.fillStyle='#3a3e44';
    for (const ang of [-1.2,0,1.2]) {
      ctx.save(); ctx.translate(21+lungeAmt*.7,-24); ctx.rotate(ang+0.3);
      ctx.beginPath(); ctx.moveTo(-1.2,-4); ctx.lineTo(0,-7.5); ctx.lineTo(1.2,-4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // petite tête casquée enfoncée dans les épaules
    ctx.fillStyle='#4a5058';
    ctx.beginPath(); ctx.arc(2,-27,3.6,0,7); ctx.fill();
    ctx.fillStyle='rgba(10,8,6,.85)';
    ctx.beginPath(); ctx.arc(2.8,-26.4,1.7,0,7); ctx.fill(); // fente d'ombre du casque
  } else {
    // ---- mineur corrompu (mob normal, voûté) ----
    // jambes
    ctx.strokeStyle='#3a332a'; ctx.lineWidth=3.2; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(-3,-7); ctx.lineTo(-4,3+trot*.5);
    ctx.moveTo(3,-7); ctx.lineTo(4,3-trot*.5);
    ctx.stroke();
    // tunique poussiéreuse, dos voûté (penché vers l'avant)
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(-6,-7); ctx.quadraticCurveTo(-8,-18, -2,-23);
    ctx.lineTo(4,-22); ctx.quadraticCurveTo(7,-14, 6,-7); ctx.closePath(); ctx.fill();
    // bras qui tient la pioche à l'épaule (la pioche pique en avant à l'attaque)
    ctx.strokeStyle = tone; ctx.lineWidth=2.8;
    ctx.beginPath(); ctx.moveTo(4,-19); ctx.lineTo(9+lungeAmt*.4,-13); ctx.stroke();
    ctx.strokeStyle='#5a4a38'; ctx.lineWidth=1.8; // manche
    ctx.beginPath(); ctx.moveTo(9+lungeAmt*.4,-13); ctx.lineTo(13+lungeAmt*.6,-24); ctx.stroke();
    ctx.strokeStyle='#8a8f96'; ctx.lineWidth=2.2; // fer de pioche
    ctx.beginPath(); ctx.moveTo(10+lungeAmt*.6,-26); ctx.quadraticCurveTo(13+lungeAmt*.6,-27.5, 16+lungeAmt*.6,-25); ctx.stroke();
    // tête encapuchonnée penchée (capuche tombante, visage dans l'ombre)
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(-4,-21); ctx.quadraticCurveTo(-3,-28.5, 2,-28);
    ctx.quadraticCurveTo(6,-27, 5,-21.5); ctx.quadraticCurveTo(0,-24, -4,-21); ctx.closePath(); ctx.fill();
    // ombre du visage sous la capuche + yeux corrompus rougeoyants
    ctx.fillStyle='rgba(12,8,6,.9)';
    ctx.beginPath(); ctx.ellipse(1.5,-22.5,2.8,2.2,-0.3,0,7); ctx.fill();
    ctx.fillStyle = w.lunge>.3 ? '#ff6a4a' : '#c8503a';
    ctx.beginPath(); ctx.arc(0.8,-22.8,0.7,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(2.8,-22.4,0.7,0,7); ctx.fill();
  }
  ctx.restore();
}
// petite icône (buste simplifié, statique) du monstre de la zone en cours, affichée en haut à
// gauche de l'écran de jeu — demande explicite du 2026-07-07. Volontairement un dessin à PART des
// silhouettes iso animées ci-dessus (même logique que les icônes d'équipement, déjà des SVG à part
// du rendu en jeu) : plus simple et robuste qu'essayer de réutiliser le rendu iso dépendant de la
// caméra dans un petit canvas indépendant.
/** Dessine la petite icône du monstre de la zone active sur le canvas #zoneMobIcon (feuillage doré à Velia, pas de monstre). */
function drawZoneMobIcon() {
  const cv2 = $('zoneMobIcon'); if (!cv2) return;
  const ctx2 = cv2.getContext('2d');
  ctx2.clearRect(0,0,34,34);
  ctx2.save();
  ctx2.translate(17,19);
  if (atVelia) {
    // zone paisible : pas de monstre, un petit feuillage doré à la place
    ctx2.fillStyle='#c9a55a';
    ctx2.beginPath(); ctx2.ellipse(-3,0,5,3,0.5,0,7); ctx2.fill();
    ctx2.beginPath(); ctx2.ellipse(3,-2,5,3,-0.5,0,7); ctx2.fill();
    ctx2.strokeStyle='#8a7038'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(0,6); ctx2.lineTo(0,-4); ctx2.stroke();
    ctx2.restore();
    return;
  }
  const zi = zoneIdx;
  const tone = (Z().tones && Z().tones[0]) || '#8a8a8a';
  if (zi === 1) { // Esprit de Protty
    ctx2.fillStyle='#cfc6e0';
    ctx2.beginPath(); ctx2.ellipse(0,0,8,7,0,Math.PI,0); ctx2.fill();
    ctx2.beginPath(); ctx2.ellipse(0,3,6,4,0,0,Math.PI); ctx2.fill();
    ctx2.fillStyle='#8878aa';
    ctx2.beginPath(); ctx2.arc(-2.5,-1,1.3,0,7); ctx2.fill();
    ctx2.beginPath(); ctx2.arc(2.5,-1,1.3,0,7); ctx2.fill();
  } else if (zi === 2) { // Pirate
    ctx2.fillStyle='#c9a074';
    ctx2.beginPath(); ctx2.arc(0,0,7,0,7); ctx2.fill();
    ctx2.fillStyle='#241d16';
    ctx2.beginPath(); ctx2.arc(0,4,5.5,0.15,Math.PI-0.15); ctx2.fill();
    ctx2.fillStyle='#a03a2e';
    ctx2.beginPath(); ctx2.arc(0,-3,7.4,Math.PI,0); ctx2.fill();
  } else if (zi === 3) { // Guerrier Rhutum
    ctx2.fillStyle='#7a9a52';
    ctx2.beginPath(); ctx2.arc(0,0,7.5,0,7); ctx2.fill();
    ctx2.fillStyle='#241d16';
    ctx2.beginPath(); ctx2.arc(0,4,5,0.1,Math.PI-0.1); ctx2.fill();
    ctx2.fillStyle='#a8402c';
    for (let i=-1;i<=1;i++) {
      ctx2.beginPath();
      ctx2.moveTo(i*3.4,-6); ctx2.lineTo(i*3.4-1.2,-13-Math.abs(i)*2); ctx2.lineTo(i*3.4+1.2,-6); ctx2.closePath(); ctx2.fill();
    }
  } else if (zi === 4) { // Garde Shultz
    ctx2.fillStyle='#c9a074';
    ctx2.beginPath(); ctx2.arc(0,1,7,0,7); ctx2.fill();
    ctx2.fillStyle='#d8d2c4';
    ctx2.beginPath(); ctx2.arc(0,4,5,0.1,Math.PI-0.1); ctx2.fill();
    ctx2.fillStyle=tone;
    ctx2.beginPath(); ctx2.arc(0,-2,7.6,Math.PI,0); ctx2.fill();
    ctx2.fillStyle='#a8402c';
    ctx2.beginPath(); ctx2.moveTo(-1.6,-8); ctx2.lineTo(0,-14); ctx2.lineTo(1.6,-8); ctx2.closePath(); ctx2.fill();
  } else if (zi === 5) { // Combattant Sausan (capuche pointue + voile)
    ctx2.fillStyle='#b8a382';
    ctx2.beginPath(); ctx2.arc(0,1,6.4,0,7); ctx2.fill();
    ctx2.fillStyle=tone; // voile de tissu sur le bas du visage
    ctx2.beginPath(); ctx2.arc(0,4,5,0.1,Math.PI-0.1); ctx2.fill();
    ctx2.strokeStyle='rgba(20,16,10,.8)'; ctx2.lineWidth=1.4; // fente des yeux
    ctx2.beginPath(); ctx2.moveTo(-3,-1); ctx2.lineTo(3,-1); ctx2.stroke();
    ctx2.fillStyle=tone; // capuche pointue rabattue
    ctx2.beginPath();
    ctx2.moveTo(-7,-1); ctx2.quadraticCurveTo(-8,-11, 0,-15);
    ctx2.quadraticCurveTo(8,-11, 7,-1);
    ctx2.quadraticCurveTo(0,-5, -7,-1); ctx2.closePath(); ctx2.fill();
    ctx2.beginPath(); ctx2.moveTo(0,-15); ctx2.lineTo(-2.4,-10); ctx2.lineTo(2.4,-10); ctx2.closePath(); ctx2.fill();
  } else if (zi === 6) { // Mineur corrompu (capuche tombante + yeux rougeoyants)
    ctx2.fillStyle=tone;
    ctx2.beginPath();
    ctx2.moveTo(-7,3); ctx2.quadraticCurveTo(-7.5,-9, 0,-11);
    ctx2.quadraticCurveTo(7.5,-9, 7,3); ctx2.closePath(); ctx2.fill();
    ctx2.fillStyle='rgba(12,8,6,.92)';
    ctx2.beginPath(); ctx2.ellipse(0,-2,4.4,3.6,0,0,7); ctx2.fill();
    ctx2.fillStyle='#c8503a';
    ctx2.beginPath(); ctx2.arc(-1.8,-2.4,1,0,7); ctx2.fill();
    ctx2.beginPath(); ctx2.arc(1.8,-2.4,1,0,7); ctx2.fill();
  } else { // silhouette générique (loup) — zones sans modèle dédié pour l'instant
    ctx2.fillStyle='#8a8f96';
    ctx2.beginPath(); ctx2.moveTo(-6,4); ctx2.lineTo(-8,-6); ctx2.lineTo(-3,-2); ctx2.lineTo(0,-8); ctx2.lineTo(3,-2); ctx2.lineTo(8,-6); ctx2.lineTo(6,4); ctx2.closePath(); ctx2.fill();
    ctx2.fillStyle='#c9ccd2';
    ctx2.beginPath(); ctx2.moveTo(-2,4); ctx2.lineTo(0,7); ctx2.lineTo(2,4); ctx2.closePath(); ctx2.fill();
  }
  ctx2.restore();
}
// dispatcher : chaque zone peut avoir sa propre silhouette de monstre — pour l'instant "Ruines de
// Protty" (zone index 1), "Repaire des Pirates" (zone index 2), "Camp Rhutum" (zone index 3),
// "Ferme Shultz" (zone index 4), "Colonie Sausan" (zone index 5) et "Mine de Fer Abandonnée"
// (zone index 6, avec sa variante boss blindée) ont la leur, les autres zones gardent la
// silhouette générique
/** @param {number} wx @param {number} wy @param {object} w @param {number} t. Aiguille vers le draw*Iso du monstre correspondant à la zone active. */
function drawMonsterIso(wx,wy,w,t) {
  if (zoneIdx === 1) return drawProttyIso(wx,wy,w,t);
  if (zoneIdx === 2) return drawPirateIso(wx,wy,w,t);
  if (zoneIdx === 3) return drawRhutumIso(wx,wy,w,t);
  if (zoneIdx === 4) return drawShultzIso(wx,wy,w,t);
  if (zoneIdx === 5) return drawSausanIso(wx,wy,w,t);
  if (zoneIdx === 6) return drawMineurIso(wx,wy,w,t);
  return drawWolfIso(wx,wy,w,t);
}

// une barre de vie PAR MONSTRE (2026-07-11, demande explicite : "chaque monstre a sa propre barre
// de vie") -- remplace l'ancienne drawPackBar, unique et partagée par tout le pack
/** @param {object} p - pack. @param {object} w - loup individuel. Dessine la barre de vie propre à ce monstre (plus grande + marqueur ◆ si alpha). */
function drawWolfHpBar(p, w) {
  const wp = wolfPos(p,w);
  const c = toScreen(wp.x,wp.y);
  const bw = w.alpha?46:28, pct = Math.max(0,w.hp/w.maxHp);
  const y = c.sy-(w.alpha?50:36);
  ctx.fillStyle='rgba(0,0,0,.55)'; ctx.fillRect(c.sx-bw/2,y,bw,4.5);
  ctx.fillStyle = pct>.35 ? '#a33d34' : '#7a2d26';
  ctx.fillRect(c.sx-bw/2,y,bw*pct,4.5);
  ctx.strokeStyle='#00000088'; ctx.strokeRect(c.sx-bw/2+.5,y+.5,bw,4.5);
  if (w.alpha) {
    ctx.fillStyle='#c9a55a'; ctx.font='bold 8px Georgia'; ctx.textAlign='center';
    ctx.fillText('◆',c.sx,y-4); ctx.textAlign='left';
  }
}

// Le rendu de la sorciere (drawWitchIso, CHAR_TIER_PALETTE, gearVisualTier, hexToRgba,
// witchBodyOn, witchBody) est desormais dans classes/sorcier/sorcier-render.js (extrait le
// 2026-07-08, reorganisation par dossiers) -- charge APRES ce fichier, voir index.html.

/** @param {object} q - particule (voir combat/vfx.js pour la création). Dessine une particule selon q.type (flash/meteor/etc.), opacité selon q.life/q.max. */
function drawParticle(q) {
  const a = q.max ? Math.max(0,q.life/q.max) : 1;
  switch (q.type) {
    case 'flash':
      ctx.fillStyle=`rgba(220,235,255,${a*.16})`;
      ctx.fillRect(0,0,W,H);
      break;
    case 'meteor': {
      const c=toScreen(q.x,q.y,q.z), g=toScreen(q.x,q.y);
      if (q.boom) { ctx.fillStyle=`rgba(255,150,70,${a})`;
        ctx.beginPath(); ctx.arc(g.sx,g.sy-4,16*(1-a)+6,0,7); ctx.fill(); }
      else {
        ctx.fillStyle='rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.ellipse(g.sx,g.sy,7*(1-q.z/330)+2,3,0,0,7); ctx.fill();
        ctx.strokeStyle='rgba(255,170,90,.7)'; ctx.lineWidth=3;
        ctx.beginPath(); ctx.moveTo(c.sx+8,c.sy-22); ctx.lineTo(c.sx,c.sy); ctx.stroke();
        ctx.fillStyle='#c96a3a'; ctx.beginPath(); ctx.arc(c.sx,c.sy,5.5,0,7); ctx.fill();
      }
      break;
    }
    case 'ice': {
      const c=toScreen(q.x,q.y,q.z), g=toScreen(q.x,q.y);
      if (q.boom) { ctx.fillStyle=`rgba(170,220,255,${a})`;
        ctx.beginPath(); ctx.arc(g.sx,g.sy-3,9*(1-a)+3,0,7); ctx.fill(); }
      else { ctx.fillStyle='rgba(180,225,255,.85)';
        ctx.save(); ctx.translate(c.sx,c.sy); ctx.rotate(.5); ctx.fillRect(-1.5,-6,3,12); ctx.restore(); }
      break;
    }
    case 'bolt': {
      const g=toScreen(q.x,q.y);
      ctx.strokeStyle=`rgba(200,230,255,${a})`; ctx.lineWidth=2.5;
      ctx.beginPath(); let y=g.sy-240, x=g.sx;
      ctx.moveTo(x,y);
      while (y < g.sy-6) { y += 30+Math.random()*20; x += Math.random()*24-12; ctx.lineTo(x,y); }
      ctx.stroke();
      ctx.fillStyle=`rgba(200,230,255,${a*.5})`;
      ctx.beginPath(); ctx.ellipse(g.sx,g.sy,14,6,0,0,7); ctx.fill();
      break;
    }
    case 'spark': {
      const c=toScreen(q.x,q.y,q.z);
      ctx.fillStyle = q.fire ? `rgba(255,160,80,${a})` : `rgba(190,150,255,${a})`;
      ctx.beginPath(); ctx.arc(c.sx,c.sy,2.2,0,7); ctx.fill();
      break;
    }
    case 'quake': {
      const g=toScreen(q.x,q.y);
      ctx.strokeStyle=`rgba(180,150,90,${a*.8})`; ctx.lineWidth=3;
      ctx.beginPath(); ctx.ellipse(g.sx,g.sy,q.r,q.r*.5,0,0,7); ctx.stroke();
      break;
    }
    case 'fireOrb': {
      if (q.done) break;
      const tt=Math.min(1,q.t);
      const x=q.x+(q.tx-q.x)*tt, y=q.y+(q.ty-q.y)*tt;
      const c=toScreen(x,y,26+Math.sin(tt*Math.PI)*30);
      ctx.fillStyle='rgba(255,150,70,.95)';
      ctx.beginPath(); ctx.arc(c.sx,c.sy,4.5,0,7); ctx.fill();
      ctx.fillStyle='rgba(255,150,70,.25)';
      ctx.beginPath(); ctx.arc(c.sx,c.sy,9,0,7); ctx.fill();
      break;
    }
    case 'castOrigin': {
      // burst à l'origine du cast (sur le joueur), identité par sort -- voir spawnCastOriginVfx
      // (combat/vfx.js) et castColor/castBurst dans SKILLS (classes/sorcier/skills-data.js)
      // Tailles/opacités doublées le 2026-07-08 ("on voit rien des visuel animation du sorcier") --
      // les valeurs d'origine (1.4 à 5px, alpha jusqu'à .6) étaient illisibles au milieu du reste du
      // combat (dégâts flottants, packs de monstres, VFX d'impact) -- code déjà correct (identité
      // par sort vérifiée), juste trop discret pour être remarqué à l'oeil nu.
      const c = toScreen(q.x,q.y,q.z||0);
      switch (q.style) {
        case 'ember':
          ctx.fillStyle=`rgba(232,147,90,${a})`;
          ctx.beginPath(); ctx.arc(c.sx,c.sy,4+3*(1-a),0,7); ctx.fill();
          break;
        case 'frost': {
          const shrink = 1-a; // se resserre vers le centre à mesure que la vie diminue
          const gx = P.x+Math.cos(q.ang)*14*shrink, gy = P.y+Math.sin(q.ang)*14*shrink;
          const gc = toScreen(gx,gy);
          ctx.fillStyle=`rgba(156,214,232,${a})`;
          ctx.save(); ctx.translate(gc.sx,gc.sy); ctx.rotate(q.ang);
          ctx.fillRect(-1.6,-6,3.2,12); ctx.restore();
          break;
        }
        case 'crackle':
          ctx.strokeStyle=`rgba(232,217,90,${a})`; ctx.lineWidth=2.6;
          ctx.beginPath(); ctx.moveTo(c.sx-7,c.sy+5); ctx.lineTo(c.sx+2,c.sy-3); ctx.lineTo(c.sx-3,c.sy-1); ctx.lineTo(c.sx+7,c.sy-10); ctx.stroke();
          break;
        case 'orb': {
          const grow = 1-a; // grossit à mesure que le cast avance (a part de 1 et descend vers 0)
          ctx.fillStyle=q.color; ctx.globalAlpha=.9;
          ctx.beginPath(); ctx.arc(c.sx,c.sy-30,4+grow*5,0,7); ctx.fill();
          ctx.globalAlpha=.4;
          ctx.beginPath(); ctx.arc(c.sx,c.sy-30,8+grow*10,0,7); ctx.fill();
          ctx.globalAlpha=1;
          break;
        }
        case 'dust':
          ctx.fillStyle=`rgba(169,122,74,${a*.85})`;
          ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,8*(1-a)+5,3.4,0,0,7); ctx.fill();
          break;
        case 'flash':
          ctx.fillStyle=`rgba(180,140,232,${a*.75})`;
          ctx.beginPath(); ctx.arc(c.sx,c.sy-20,24*(1-a)+7,0,7); ctx.fill();
          break;
        case 'flicker':
          ctx.fillStyle=`rgba(191,232,240,${a})`;
          ctx.beginPath(); ctx.arc(c.sx,c.sy,3.2,0,7); ctx.fill();
          break;
        case 'shimmer':
          ctx.fillStyle=`rgba(240,230,192,${a*.9})`;
          ctx.beginPath(); ctx.arc(c.sx,c.sy,2.6,0,7); ctx.fill();
          break;
      }
      break;
    }
    case 'tpTrail': {
      const a1=toScreen(q.x1,q.y1), a2=toScreen(q.x2,q.y2);
      ctx.strokeStyle=`rgba(140,200,255,${a*.7})`; ctx.lineWidth=8*a;
      ctx.beginPath(); ctx.moveTo(a1.sx,a1.sy-24); ctx.lineTo(a2.sx,a2.sy-24); ctx.stroke();
      break;
    }
    case 'pickup': {
      const g=toScreen(q.x,q.y);
      ctx.strokeStyle=q.color; ctx.globalAlpha=a; ctx.lineWidth=2;
      ctx.beginPath(); ctx.ellipse(g.sx,g.sy-4,12*(1-a)+4,6*(1-a)+2,0,0,7); ctx.stroke();
      ctx.globalAlpha=1;
      break;
    }
  }
}

/** Dessine tous les textes flottants actifs (dégâts, gain silver/or, level up...), couleur/taille selon le type, fondu selon f.life. */
function drawFloats() {
  const s = uiTextScale();
  for (const f of floats) {
    const c = toScreen(f.x,f.y,f.z+(1-f.life)*36);
    ctx.globalAlpha = Math.max(0,Math.min(1,f.life));
    const base = f.lvl?15:f.crit?14:12;
    ctx.font = (f.lvl?'bold ':f.crit?'bold ':'')+(base*s)+'px Georgia';
    ctx.fillStyle = f.silver||f.gold?'#c9a55a':f.lvl||f.blue?'#9cc9e8':f.green?'#8fc98a':f.hurt?'#e06050':f.crit?'#ffbe78':'#e88';
    ctx.textAlign='center'; ctx.fillText(f.txt,c.sx,c.sy); ctx.textAlign='left';
    ctx.globalAlpha=1;
  }
}

/** @param {number} t - timestamp. Rendu complet d'une frame du canvas monde (sol, entités, textes flottants, vignette, tremblement d'écran). */
function render(t) {
  ctx.save();
  if (shakeT > 0) { shakeT -= 1/60; ctx.translate((Math.random()-.5)*shakeAmp,(Math.random()-.5)*shakeAmp); }
  drawGround();
  drawEntities(t);
  drawFloats();
  const v = ctx.createRadialGradient(W/2,H/2,H*.4,W/2,H/2,H*.85);
  v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.4)');
  ctx.fillStyle=v; ctx.fillRect(0,0,W,H);
  ctx.restore();
}

// démarrage du jeu (2026-07-14, déplacé depuis la toute fin de game-core.js lors de son extraction
// dans render.js) -- hud() appelle drawZoneMobIcon() (défini ci-dessus), donc ce premier appel doit
// attendre que CE fichier soit chargé ; requestAnimationFrame(loop) doit rester le tout dernier
// appel synchrone, quel que soit le fichier, sinon la boucle de jeu ne démarre jamais
renderInvCatTabs();
hud();
setInterval(hud, 1000);
setInterval(() => { if (!document.hidden) S.playtimeSec++; }, 1000); // temps de jeu cumulé (onglet actif uniquement)
setTimeout(()=>{ addSilver(80, 'welcome'); hud(); }, 1200);
// sauvegarde automatique locale (fallback hors-ligne, coexiste avec Supabase)
setInterval(() => { try { localStorage.setItem('velia-idle-save', JSON.stringify(getSaveState())); } catch(e) {} }, 15000);
requestAnimationFrame(loop);

