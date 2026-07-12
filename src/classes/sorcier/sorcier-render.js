// ==================== CLASSE SORCIER : rendu du personnage ====================
// Extrait de world/render.js le 2026-07-08 (reorganisation par dossiers, prepare l'ajout
// futur d'autres classes jouables) -- DOIT charger APRES world/render.js (toScreen/ctx/P) :
// drawWitchIso est appele via une closure (voir drawEntities dans render.js), jamais au
// chargement immediat.
/** @param {number} t - timestamp. Dessine la sorcière en isométrique (K.O. couché si P.faint, sinon debout avec bob de marche, halos loot/téléport/buff), délègue le corps à witchBody(). */
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
  witchBody(t, P.castingSkill);
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
// "ornements" orbitaux par palier (2026-07-08, demande explicite : "créer des effet de plus en
// plus visuel pour les sors avec des ornement... bleu = 5 ornement vert = 4 et le reste peu de
// visuel moins flashy... bleu = tres flashy tres visuel") -- récompense visuelle progressive de
// palier en palier : gris/blanc restent discrets (1-2 petits éclats ternes), vert en montre 4,
// bleu en montre 5 nettement plus gros/lumineux/rapides -- surtout pendant un cast (voir `flash`,
// multiplie taille/opacité, ajoute un halo supplémentaire aux 2 paliers hauts uniquement).
const ORNAMENT_TIER = {
  grey:  { n:1, flash:.28 },
  white: { n:2, flash:.45 },
  green: { n:4, flash:.72 },
  blue:  { n:5, flash:1.0 },
};
// palier visuel = le plus HAUT palier de couleur présent parmi les pièces équipées (arme/armure) —
// null si rien d'équipé, retombe alors sur le gris par défaut (voir witchBody/drawWitchOn)
/** @returns {string|null} le plus haut palier de couleur (grey/white/green/blue) parmi les pièces équipées (arme/armure), null si rien d'équipé. */
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
/** @param {string} hex - couleur #rgb ou #rrggbb. @param {number} alpha. @returns {string} chaîne rgba() équivalente. */
function hexToRgba(hex, alpha) {
  const h = hex.replace('#','');
  const num = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return `rgba(${(num>>16)&0xff},${(num>>8)&0xff},${num&0xff},${alpha})`;
}
// dessine le corps de la sorcière sur un contexte 2D donné (ctx global en jeu, ou un contexte de
// prévisualisation dédié — voir drawWitchOn) : factorisé le 2026-07-08 pour que le personnage en
// combat ET la prévisualisation de l'équipement partagent EXACTEMENT le même rendu par palier
// castingSkill : objet SKILLS en cours de cast, ou falsy (idle/K.O.) -- avant le 2026-07-18 ce
// paramètre n'était qu'un booléen ; désormais l'objet skill lui-même pour lire castColor/
// castBurst/castJitter et donner à chaque sort une identité visuelle propre côté personnage
// (avant, bâton+cristal identiques pour les 10 sorts, seul le VFX d'IMPACT variait)
/** @param {CanvasRenderingContext2D} g - contexte 2D cible (combat ou prévisualisation). @param {number} t @param {object|false} castingSkill - objet SKILLS en cours de cast, ou falsy. Dessine le corps de la sorcière (robe/capuche/ornements) selon gearVisualTier(), partagé entre combat et aperçu équipement. */
function witchBodyOn(g, t, castingSkill) {
  const casting = !!castingSkill;
  const sway = Math.sin(P.bob*.9)*2;
  const grade = gearVisualTier() || 'grey';
  const pal = CHAR_TIER_PALETTE[grade];
  // repli sur la teinte du palier si le sort n'a pas (encore) de castColor propre -- ne devrait
  // pas arriver (tous les SKILLS en ont un), garde-fou uniquement
  const castColor = (castingSkill && castingSkill.castColor) || pal.trim;
  const jitterMult = (castingSkill && castingSkill.castJitter) || 1;
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
  // contour net + galon central doré (2026-07-23, demande explicite : "inspiré du sprite IA
  // (navy/or, capuche, cape)") -- silhouette plus définie et détail de robe repris du concept
  // art généré, mais redessiné en formes canvas (pas de sprite/image, rendu procédural inchangé)
  g.strokeStyle=hexToRgba(pal.trim,.75); g.lineWidth=1;
  g.beginPath();
  g.moveTo(-3,-18); g.quadraticCurveTo(-14+sway,8,-11+sway,24);
  g.lineTo(11-sway,24); g.quadraticCurveTo(13-sway,6,3,-18);
  g.stroke();
  g.strokeStyle=pal.trim; g.lineWidth=1.4;
  g.beginPath(); g.moveTo(0,-16); g.quadraticCurveTo(-1+sway*.3,6,0,23); g.stroke();
  g.beginPath(); g.moveTo(-10.4+sway,21.6); g.lineTo(10.4-sway,21.6); g.stroke();
  // ceinture + dague au fourreau : seulement si une arme secondaire est équipée (2026-07-23,
  // même logique que les orbes d'éveil ci-dessous, conditionnées par EQUIP.awakening) -- le slot
  // secondary est bien une dague en jeu (voir GEAR_TIERS[].sets.secondary, "Dague Naru/Tuvala/
  // Yuria/Grunil"), donc ce détail visuel raconte un vrai équipement, pas un ajout arbitraire
  if (EQUIP.secondary) {
    g.strokeStyle='#5a4632'; g.lineWidth=2.6;
    g.beginPath(); g.moveTo(-10.5+sway,14); g.lineTo(10.5-sway,15.5); g.stroke();
    g.save(); g.translate(7-sway*.3,17); g.rotate(.25);
    g.fillStyle='#5a4632'; g.fillRect(-1.6,-3,3.2,7);
    g.fillStyle='#8a95a3'; g.beginPath();
    g.moveTo(-1.6,4); g.lineTo(1.6,4); g.lineTo(0,11); g.closePath(); g.fill();
    g.fillStyle=pal.trim; g.fillRect(-1.9,-4.4,3.8,2);
    g.restore();
  }
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
  g.beginPath(); g.moveTo(-6.4,-31); g.quadraticCurveTo(-2,-46,5.5,-42);
  g.quadraticCurveTo(3.5,-37,6.4,-31); g.stroke();
  // cornes : palier vert et bleu uniquement (2026-07-08, même logique que les icônes de casque)
  if (pal.horn) {
    g.fillStyle = pal.trim;
    g.beginPath(); g.moveTo(-9,-32); g.quadraticCurveTo(-14,-40,-11,-48); g.quadraticCurveTo(-9,-40,-6,-33); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(9,-32); g.quadraticCurveTo(14,-40,11,-48); g.quadraticCurveTo(9,-40,6,-33); g.closePath(); g.fill();
  }
  // tremblement du bâton pendant le cast : vitesse propre à chaque sort (castJitter, 2026-07-18)
  // -- un sort rapide à lancer (voltaic, castT .32) tremble plus nerveusement qu'un sort lent et
  // lourd (meteor, castT .85), pour que la sensation de cast varie même sans regarder l'icône
  const staffAng = casting ? -0.5+Math.sin(t*10*jitterMult)*.08 : 0.18;
  g.save(); g.translate(9,-14); g.rotate(staffAng);
  g.strokeStyle='#6b5a42'; g.lineWidth=2.6; g.lineCap='round';
  g.beginPath(); g.moveTo(0,22); g.lineTo(0,-22); g.stroke();
  // couleur du cristal pendant le cast = castColor du sort en cours (identité par sort), sinon
  // la teinte du palier au repos (comportement d'origine, inchangé hors cast)
  const glowColor = casting ? castColor : pal.trim;
  const glow = casting ? .85+Math.sin(t*12*jitterMult)*.15 : .4;
  // "on voit rien des visuel animation du sorcier" (2026-07-08) -- le cristal (diamant ~8px) et
  // son aura étaient trop discrets pour être perçus pendant un cast (souvent <0.5s) au milieu du
  // reste du combat -- grossi de 60% + aura plus opaque/plus large + anneau de contour net pendant
  // le cast, pour que l'identité visuelle par sort (déjà correcte en code, vérifié par diff de
  // pixels) soit enfin repérable à l'oeil nu, pas seulement en inspectant les pixels.
  const crystalScale = casting ? 1.6 : 1;
  g.fillStyle=hexToRgba(glowColor, glow);
  g.save(); g.translate(0,-24.5); g.scale(crystalScale,crystalScale);
  g.beginPath(); g.moveTo(0,-5.5); g.lineTo(4,1.5); g.lineTo(0,5.5); g.lineTo(-4,1.5); g.closePath(); g.fill();
  g.restore();
  if (casting) {
    g.fillStyle=hexToRgba(glowColor,.4);
    g.beginPath(); g.arc(0,-24,13+Math.sin(t*12*jitterMult)*3,0,7); g.fill();
    g.strokeStyle=hexToRgba(glowColor,.9); g.lineWidth=1.6;
    g.beginPath(); g.arc(0,-24,6+Math.sin(t*12*jitterMult)*1.5,0,7); g.stroke();
  }
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
  // ornements de palier (voir ORNAMENT_TIER ci-dessus) : petits éclats en orbite autour du buste,
  // couleur du sort en cours pendant un cast (comme le cristal), sinon la teinte du palier au repos
  const orn = ORNAMENT_TIER[grade];
  const ornColor = casting ? castColor : pal.trim;
  const ornOrbitR = 19 + (casting ? 3 : 0);
  for (let i=0;i<orn.n;i++) {
    const ang = t*(1.3+jitterMult*.25) + i*(Math.PI*2/orn.n);
    const ox = Math.cos(ang)*ornOrbitR, oy = Math.sin(ang)*ornOrbitR*.5 - 21;
    const pulse = .5+.5*Math.sin(t*(casting?9*jitterMult:2.2)+i*1.7);
    const size = (1+pulse*1.3) * orn.flash * (casting?1.35:1);
    const alpha = Math.min(1, (.3+pulse*.4) * orn.flash * (casting?1.3:.8));
    g.fillStyle = hexToRgba(ornColor, alpha);
    g.beginPath(); g.arc(ox, oy, size, 0, 7); g.fill();
    // halo supplémentaire réservé aux 2 paliers hauts (vert/bleu) pendant le cast -- "bleu = tres
    // flashy tres visuel" : c'est CE halo, absent en gris/blanc, qui crée l'écart perçu de palier
    if (casting && orn.flash >= .7) {
      g.fillStyle = hexToRgba(ornColor, alpha*.3);
      g.beginPath(); g.arc(ox, oy, size*2.2, 0, 7); g.fill();
    }
  }
}
/** @param {number} t @param {object|false} castingSkill. Dessine le corps de la sorcière sur le contexte de jeu global (ctx) — voir witchBodyOn. */
function witchBody(t,castingSkill) { witchBodyOn(ctx, t, castingSkill); }
