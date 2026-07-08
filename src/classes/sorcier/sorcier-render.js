// ==================== CLASSE SORCIER : rendu du personnage ====================
// Extrait de world/render.js le 2026-07-08 (reorganisation par dossiers, prepare l'ajout
// futur d'autres classes jouables) -- DOIT charger APRES world/render.js (toScreen/ctx/P) :
// drawWitchIso est appele via une closure (voir drawEntities dans render.js), jamais au
// chargement immediat.
function drawWitchIso(t) {
  const c = toScreen(P.x,P.y);
  if (P.faint > 0) {
    ctx.save(); ctx.translate(c.sx,c.sy-6); ctx.rotate(-Math.PI/2); ctx.globalAlpha=.7;
    witchBody(t,false); ctx.restore();
    ctx.fillStyle='#e06050'; ctx.font='bold 11px Georgia'; ctx.textAlign='center';
    ctx.fillText('K.O. '+Math.ceil(P.faint)+'s',c.sx,c.sy-46); ctx.textAlign='left';
    return;
  }
  const walking = ['move','loot','kite','gather'].includes(P.state);
  const bobY = Math.sin(P.bob)*(walking?3:1.2);
  ctx.fillStyle='rgba(0,0,0,.32)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,12,4.4,0,0,7); ctx.fill();
  if (P.state==='loot') {
    ctx.strokeStyle='rgba(201,165,90,.22)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,S.lootRadius,S.lootRadius*.5,0,0,7); ctx.stroke();
  }
  if (P.tpFlash > 0) {
    ctx.fillStyle=`rgba(140,200,255,${P.tpFlash*.35})`;
    ctx.beginPath(); ctx.arc(c.sx,c.sy-26,30,0,7); ctx.fill();
  }
  if (buffTimer > 0) {
    ctx.strokeStyle='rgba(201,165,90,.4)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+1,20,7,0,0,7); ctx.stroke();
  }
  ctx.save();
  ctx.translate(c.sx,c.sy-24+bobY);
  if (P.faceX < 0) ctx.scale(-1,1);
  witchBody(t, P.castingSkill != null);
  ctx.restore();
  // barre d'incantation et de PV retirées d'au-dessus du personnage (2026-07-05, demande
  // explicite) : la barre d'incantation vit désormais près de la barre de sorts (#castBar) et
  // la barre de PV reste uniquement en bas à gauche (#hpBar) -- voir renderCastBar()/hud()
}

// tient compte de la couleur des pièces équipées pour changer l'apparence du personnage
// (2026-07-08, demande explicite : "ajoute le nouveau personnage et ses couleurs selon stuff") —
// réutilise les mêmes couleurs que les icônes de stuff (armorIconForColor & co), gris/blanc en
// tons clairs, vert/bleu en version sombre desaturée pour rester lisible en robe
const CHAR_TIER_PALETTE = {
  grey:  { robe:'#6f7d8a', hat:'#586773', hatDark:'#465360', horn:false, cape:false, trim:'#c9a55a' },
  white: { robe:'#c3c9cc', hat:'#9aa0a3', hatDark:'#7a8083', horn:false, cape:false, trim:'#e8e8e8' },
  green: { robe:'#3d4a3a', hat:'#26301f', hatDark:'#182015', horn:true,  cape:false, trim:'#7aa35e' },
  blue:  { robe:'#20303c', hat:'#16232b', hatDark:'#0a1216', horn:true,  cape:true,  trim:'#6ea3c9' },
};
// palier visuel = le plus HAUT palier de couleur présent parmi les pièces équipées (arme/armure) —
// null si rien d'équipé, retombe alors sur le gris par défaut (voir witchBody/drawWitchOn)
function gearVisualTier() {
  const rank = { blue:0, green:1, white:2, grey:3 };
  const gradeByColor = {}; GEAR_TIERS.forEach(t => gradeByColor[t.color] = t.grade);
  let best = null, bestRank = 4;
  for (const slot of ['weapon','awakening','secondary','helmet','armor','gloves','boots']) {
    const e = EQUIP[slot];
    const g = e && e.color && gradeByColor[e.color];
    if (g && rank[g] < bestRank) { bestRank = rank[g]; best = g; }
  }
  return best;
}
function hexToRgba(hex, alpha) {
  const h = hex.replace('#','');
  const num = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return `rgba(${(num>>16)&0xff},${(num>>8)&0xff},${num&0xff},${alpha})`;
}
// dessine le corps de la sorcière sur un contexte 2D donné (ctx global en jeu, ou un contexte de
// prévisualisation dédié — voir drawWitchOn) : factorisé le 2026-07-08 pour que le personnage en
// combat ET la prévisualisation de l'équipement partagent EXACTEMENT le même rendu par palier
function witchBodyOn(g, t, casting) {
  const sway = Math.sin(P.bob*.9)*2;
  const grade = gearVisualTier() || 'grey';
  const pal = CHAR_TIER_PALETTE[grade];
  if (pal.cape) {
    g.fillStyle = hexToRgba(pal.hat,.9);
    g.beginPath();
    g.moveTo(-9+sway*.6,-14); g.quadraticCurveTo(-22,10,-15,27);
    g.lineTo(-5,25); g.quadraticCurveTo(-11,4,-3,-16);
    g.closePath(); g.fill();
  }
  g.fillStyle=pal.robe;
  g.beginPath();
  g.moveTo(-3,-18);
  g.quadraticCurveTo(-14+sway,8,-11+sway,24);
  g.lineTo(11-sway,24);
  g.quadraticCurveTo(13-sway,6,3,-18);
  g.closePath(); g.fill();
  g.strokeStyle=pal.trim; g.lineWidth=1.4;
  g.beginPath(); g.moveTo(-10.4+sway,21.6); g.lineTo(10.4-sway,21.6); g.stroke();
  g.fillStyle=pal.robe; g.fillRect(-5,-20,10,12);
  g.fillStyle='#e8e0cf'; g.fillRect(-2.4,-19,4.8,9);
  g.fillStyle='#e9c9a8'; g.beginPath(); g.arc(0,-26,5.6,0,7); g.fill();
  g.fillStyle=pal.hatDark; g.beginPath(); g.arc(-1,-28,5.4,Math.PI*.85,Math.PI*1.95); g.fill();
  g.fillStyle=pal.hat;
  g.beginPath(); g.ellipse(0,-30.5,12.5,3.4,-.07,0,7); g.fill();
  g.beginPath(); g.moveTo(-6.4,-31); g.quadraticCurveTo(-2,-46,5.5,-42);
  g.quadraticCurveTo(3.5,-37,6.4,-31); g.closePath(); g.fill();
  g.strokeStyle=pal.trim; g.lineWidth=1.1;
  g.beginPath(); g.ellipse(0,-30.5,12.5,3.4,-.07,0,7); g.stroke();
  // cornes : palier vert et bleu uniquement (2026-07-08, même logique que les icônes de casque)
  if (pal.horn) {
    g.fillStyle = pal.trim;
    g.beginPath(); g.moveTo(-9,-32); g.quadraticCurveTo(-14,-40,-11,-48); g.quadraticCurveTo(-9,-40,-6,-33); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(9,-32); g.quadraticCurveTo(14,-40,11,-48); g.quadraticCurveTo(9,-40,6,-33); g.closePath(); g.fill();
  }
  const staffAng = casting ? -0.5+Math.sin(t*10)*.08 : 0.18;
  g.save(); g.translate(9,-14); g.rotate(staffAng);
  g.strokeStyle='#6b5a42'; g.lineWidth=2.6; g.lineCap='round';
  g.beginPath(); g.moveTo(0,22); g.lineTo(0,-22); g.stroke();
  const glow = casting ? .85+Math.sin(t*12)*.15 : .4;
  g.fillStyle=hexToRgba(pal.trim, glow);
  g.beginPath(); g.moveTo(0,-30); g.lineTo(4,-23); g.lineTo(0,-19); g.lineTo(-4,-23); g.closePath(); g.fill();
  if (casting) { g.fillStyle=hexToRgba(pal.trim,.25);
    g.beginPath(); g.arc(0,-24,9+Math.sin(t*12)*2,0,7); g.fill(); }
  g.restore();
  // orbes d'éveil en orbite : uniquement si une pièce d'éveil est équipée (2026-07-08, demande
  // explicite, même esprit que orbPairIconForColor)
  if (EQUIP.awakening) {
    const ang = t*1.4;
    [[Math.cos(ang)*16, Math.sin(ang)*7-10, 3.2], [Math.cos(ang+Math.PI)*11, Math.sin(ang+Math.PI)*5-6, 2.4]].forEach(([ox,oy,r]) => {
      g.fillStyle = hexToRgba(pal.trim,.9);
      g.beginPath(); g.arc(ox, oy-20, r, 0, 7); g.fill();
    });
  }
}
function witchBody(t,casting) { witchBodyOn(ctx, t, casting); }
