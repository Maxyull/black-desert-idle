// ==================== ICONES SVG (equipement/bijoux/materiaux/pierre de Cron) ====================
// Extrait de game-core.js le 2026-07-08 (reorganisation par dossiers) -- module 100% autonome
// (aucune dependance vers l'etat du jeu), charge AVANT core/game-core.js dans index.html : plusieurs
// constantes ici (ICO_MAT_*, ICO_CRON_STONE, ICO_COEUR_VELL...) appellent svgIcon() immediatement
// au chargement, et GEAR_TIERS (dans core/game-core.js) lit ICO_MAT_* immediatement aussi.
// icônes SVG originales (dessinées pour ce projet, aucun asset BDO réel) — plus détaillées :
// base + reflets + ombres pour un rendu plus joli, remplissant davantage la case
/** @param {string} inner - contenu SVG interne (paths). @returns {string} balise <svg class="gicon"> encapsulant inner (viewBox 24×24). */
function svgIcon(inner) { return `<svg class="gicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`; }
// livre (compétences de vie) : couverture bleue + tranche + pages
const ICO_BOOK = svgIcon(
  '<path d="M4 4.5c3-1.2 5.5-1 8 .5v15c-2.5-1.5-5-1.7-8-.5z" fill="#3a6ea8"/>' +
  '<path d="M20 4.5c-3-1.2-5.5-1-8 .5v15c2.5-1.5 5-1.7 8-.5z" fill="#5a8fc8"/>' +
  '<path d="M12 5v15" stroke="#274a6e" stroke-width="1.4"/><path d="M14 8h4M14 11h4M6 8h4M6 11h4" stroke="#dfeaf5" stroke-width="0.9"/>');
// éclaircit/assombrit une couleur hex (amt en [-255,255]) — sert à générer les tons d'ombre/lumière
// des icônes teintées par palier de stuff ci-dessous
/** @param {string} hex - couleur #rgb ou #rrggbb. @param {number} amt - décalage par canal, en [-255,255]. @returns {string} couleur hex éclaircie (amt>0) ou assombrie (amt<0), clampée. */
function shadeHex(hex, amt) {
  const h = hex.replace('#','');
  const num = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  let r = (num>>16) + amt, g = ((num>>8)&0xff) + amt, b = (num&0xff) + amt;
  r = Math.max(0,Math.min(255,r)); g = Math.max(0,Math.min(255,g)); b = Math.max(0,Math.min(255,b));
  return '#' + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
}
// fond de case selon la rareté (remplace l'ancien halo autour de l'objet, demande explicite du
// 2026-07-08 : "enleve le halo et met un fond de couleur plus ou moins abouti selon la rareté") —
// rien pour gris/blanc, teinte + coins marqués au vert, teinte + coins ornés de losanges au bleu.
// tierIdx : 0=gris/blanc, 1=vert, 2=bleu (voir JEWEL_TIER_IDX plus bas)
/** @param {number} tierIdx - 0=gris/blanc, 1=vert, 2+=bleu (JEWEL_TIER_IDX). @param {string} color. @returns {string} SVG du fond de case selon la rareté (rien au gris/blanc, teinte+coins au vert, teinte+coins+losanges au bleu). */
function rarityBackdrop(tierIdx, color) {
  if (tierIdx === 1) return `<rect x="1" y="1" width="22" height="22" rx="4" fill="${color}" opacity=".14"/>` +
    `<path d="M2 6.5l4.5-4.5M22 6.5l-4.5-4.5M2 17.5l4.5 4.5M22 17.5l-4.5 4.5" stroke="${color}" stroke-width="1" opacity=".5"/>`;
  if (tierIdx >= 2) return `<rect x="1" y="1" width="22" height="22" rx="4" fill="${color}" opacity=".18"/>` +
    `<path d="M2 7.5l5.5-5.5M22 7.5l-5.5-5.5M2 16.5l5.5 5.5M22 16.5l-5.5 5.5" stroke="${color}" stroke-width="1.2" opacity=".65"/>` +
    `<path d="M12 .3l1.5 1.9-1.5 1.9-1.5-1.9z" fill="${color}" opacity=".7"/><path d="M12 23.7l1.5-1.9-1.5-1.9-1.5 1.9z" fill="${color}" opacity=".7"/>`;
  return '';
}
// ornements communs à toute pièce de stuff (armes, armure, bijoux) : rien au gris/blanc, 4 rivets
// pleins au vert, 4 gemmes claires + 1 losange central (5e ornement) au bleu — demande explicite du
// 2026-07-08 : "ornement 5 pour la bleu et 4 pour la verte", appliqué de façon cohérente partout
/** @param {number} tierIdx - 0=gris/blanc (rien), 1=vert (rivets pleins), 2+=bleu (gemmes + losange central). @param {[number,number][]} positions - coordonnées des rivets/gemmes. @param {string} color. @param {[number,number]} [center] - position du 5e ornement (losange), bleu uniquement. @returns {string} SVG des ornements. */
function gearOrnaments(tierIdx, positions, color, center) {
  if (tierIdx === 1) return positions.map(([x,y]) => `<circle cx="${x}" cy="${y}" r=".6" fill="${color}"/>`).join('');
  if (tierIdx >= 2) {
    const gem = shadeHex(color, 60);
    let out = positions.map(([x,y]) => `<circle cx="${x}" cy="${y}" r=".6" fill="${gem}"/>`).join('');
    if (center) out += `<path d="M${center[0]} ${center[1]-1.3}l1.3 1.3-1.3 1.3-1.3-1.3z" fill="#eaf6ff"/>`;
    return out;
  }
  return '';
}
// arme principale : bâton de sorcier (manche + tête sertie d'un cristal), teinté par palier —
// remplace l'ancienne arme fixe (2026-07-08, demande explicite : "l'arme c'est un baton de sorcier")
/** @param {string} color @param {string} grade - 'grey'/'white'/'green'/'blue'. @returns {string} SVG de l'arme principale (bâton de sorcier), teintée par palier. */
function staffIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const wood = grade==='grey' ? '#6b5030' : grade==='white' ? '#7a8083' : grade==='green' ? '#26301f' : '#0a1216';
  const gem = grade==='grey' ? '#9aa0a3' : color;
  const cage = grade==='grey' ? wood : shadeHex(color,-95);
  let claws = '';
  if (grade==='green') claws = `<path d="M12 1.8c-2.2.6-3.6 2-4 4.2l2 1.6c-.2-2 .5-3.8 2-5.8z" fill="${cage}"/><path d="M12 1.8c2.2.6 3.6 2 4 4.2l-2 1.6c.2-2-.5-3.8-2-5.8z" fill="${shadeHex(cage,-30)}"/>`;
  if (grade==='blue') claws = `<path d="M12 1.4c-2.6.5-4.3 2.1-4.8 4.8l2.3 1.8c-.4-2.4.5-4.5 2.5-6.6z" fill="${cage}"/><path d="M12 1.4c2.6.5 4.3 2.1 4.8 4.8l-2.3 1.8c.4-2.4-.5-4.5-2.5-6.6z" fill="${shadeHex(cage,-30)}"/>`;
  let cross = '';
  if (grade==='white') cross = `<rect x="10.6" y="12" width="2.8" height="1.2" rx=".5" fill="${gem}"/>`;
  if (grade==='blue') cross = `<rect x="10.6" y="11.6" width="2.8" height="1.1" rx=".5" fill="${gem}"/><rect x="10.6" y="14.4" width="2.8" height="1.1" rx=".5" fill="${gem}" opacity=".65"/>`;
  const rivets = gearOrnaments(t, [[12,10.4],[12,13.2],[12,16],[12,18.8]], color, [12,15]);
  return svgIcon(rarityBackdrop(t,color) + claws +
    `<rect x="11" y="7.5" width="2" height="14.5" rx="1" fill="${wood}"/><rect x="11" y="7.5" width=".9" height="14.5" rx=".45" fill="${shadeHex(wood,40)}"/>` +
    cross +
    `<path d="M12 3l1.7 1.9-1.7 2.6-1.7-2.6z" fill="${shadeHex(gem,30)}"/><path d="M12 3l1.7 1.9-1.7 2.6z" fill="${gem}"/>` +
    `<circle cx="12" cy="5" r=".5" fill="#eaf6ff"/>` +
    rivets);
}
// arme secondaire : dague, teintée par palier — remplace l'ancienne dague fixe
/** @param {string} color @param {string} grade. @returns {string} SVG de l'arme secondaire (dague), teintée par palier. */
function daggerIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const blade = grade==='grey' ? '#8f9aa6' : grade==='white' ? '#e8e8e8' : grade==='green' ? '#3d4a3a' : '#20303c';
  const bladeDark = grade==='green' ? '#26301f' : grade==='blue' ? '#16232b' : shadeHex(blade,-30);
  const guard = grade==='grey' ? '#5f6873' : grade==='white' ? '#9aa0a3' : grade==='green' ? '#182015' : '#0a1216';
  const pommel = grade==='grey' ? '#6b5030' : grade==='white' ? '#7a8083' : grade==='green' ? '#26301f' : '#0a1216';
  const fuller = grade!=='grey' ? `<path d="M12 9.6v9.8" stroke="${grade==='white'?guard:color}" stroke-width=".55"/>` : '';
  const curvedGuard = (grade==='green'||grade==='blue')
    ? `<path d="M7.6 8.4c1.4-1 3-1.4 4.4-1.4s3 .4 4.4 1.4l-.8 1.2c-1.2-.7-2.4-1-3.6-1s-2.4.3-3.6 1z" fill="${guard}"/>`
    : `<rect x="8.2" y="7.6" width="7.6" height="1.7" rx=".8" fill="${guard}"/>`;
  const rivets = gearOrnaments(t, [[9.2,8.9],[14.8,8.9],[12,4.4],[12,6.4]], color, [12,10.5]);
  return svgIcon(rarityBackdrop(t,color) +
    `<path d="M12 22l-2.2-4.6V9h4.4v8.4z" fill="${blade}"/><path d="M12 22l-2.2-4.6V9H12z" fill="${bladeDark}"/>` +
    fuller + curvedGuard +
    `<rect x="11" y="3.4" width="2" height="4.2" rx=".9" fill="${pommel}"/><circle cx="12" cy="2.8" r="1.1" fill="${guard}"/>` +
    rivets);
}
// éveil : deux sphères Aad flottant en lévitation (remplace l'ancienne grande épée dorée, 2026-07-08
// demande explicite : "l'eveil c'est 2 boules flottante" / "que les 2 boules ce sont des sphere aad")
/** @param {string} color @param {string} grade. @returns {string} SVG de l'arme d'éveil (2 sphères Aad flottantes), teintée par palier. */
function orbPairIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const stone = grade==='grey' ? '#6b6f74' : grade==='white' ? '#cfd8dc' : grade==='green' ? '#182015' : '#0f1a20';
  const ringCol = grade==='grey' ? '#43494f' : grade==='white' ? '#9aa0a3' : color;
  let bigCore = '', smallCore = '';
  if (grade === 'grey') { bigCore = '<circle cx="7.6" cy="9.1" r="1.1" fill="#8f9aa6"/>'; smallCore = '<circle cx="15.5" cy="13.9" r=".75" fill="#8f9aa6"/>'; }
  else if (grade === 'white') { bigCore = '<circle cx="7.6" cy="9.1" r="1.2" fill="#fff"/>'; smallCore = '<circle cx="15.5" cy="13.9" r=".8" fill="#fff"/>'; }
  else if (grade === 'green') {
    bigCore = `<path d="M9 7.4c1.7 1.2 2.3 2.7 1.8 4.4-.5 1.3-1.8 2.1-1.8 2.1s-1.3-.8-1.8-2.1c-.5-1.7.1-3.2 1.8-4.4z" fill="${color}" opacity=".8"/>`;
    smallCore = `<path d="M16.4 12.8c1.1.8 1.5 1.8 1.2 2.9-.3.9-1.2 1.4-1.2 1.4s-.9-.5-1.2-1.4c-.3-1.1.1-2.1 1.2-2.9z" fill="${color}" opacity=".8"/>`;
  } else {
    bigCore = '<path d="M9.8 7.6l-1.9 3.3h1.5L8 14.3l3.3-4.3H9.6z" fill="#dfeaf4"/>';
    smallCore = '<path d="M17 13l-1.3 2.2h1l-.9 2.1 2.2-2.9h-1.1z" fill="#dfeaf4"/>';
  }
  const rivets = gearOrnaments(t, [[3.6,8.4],[14.2,12.2],[12.4,6.2],[19.8,11.7]], color, [12,17.2]);
  return svgIcon(rarityBackdrop(t,color) +
    `<circle cx="9" cy="10.5" r="4.2" fill="${stone}"/><circle cx="9" cy="10.5" r="4.2" fill="none" stroke="${ringCol}" stroke-width=".8"/>` +
    bigCore +
    `<circle cx="16.4" cy="14.8" r="2.9" fill="${stone}"/><circle cx="16.4" cy="14.8" r="2.9" fill="none" stroke="${ringCol}" stroke-width=".8"/>` +
    smallCore +
    `<path d="M7 17.8h4M14.6 19.6h3.6" stroke="${ringCol}" stroke-width=".8" stroke-linecap="round"/>` +
    rivets);
}
// casque : heaume avec fente en Y, teinté par palier — cornes qui apparaissent au vert/bleu
/** @param {string} color @param {string} grade. @returns {string} SVG du casque, teinté par palier (cornes au vert/bleu). */
function helmetIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const base = (grade==='green'||grade==='blue') ? shadeHex(color,-95) : color;
  const dark = shadeHex(base,-40), visor = shadeHex(base,-90);
  let horns = '';
  if (grade==='white') horns = `<path d="M9 8l-1.6-2.6 1.4-.6z" fill="${shadeHex(color,-20)}"/><path d="M15 8l1.6-2.6-1.4-.6z" fill="${shadeHex(color,-20)}"/>`;
  if (grade==='green') horns = `<path d="M6.2 6.8C4.8 5.6 4.4 4 5 2.4c.5 1.5 1.5 2.6 2.9 3.2z" fill="${shadeHex(color,70)}"/><path d="M17.8 6.8c1.4-1.2 1.8-2.8 1.2-4.4-.5 1.5-1.5 2.6-2.9 3.2z" fill="${shadeHex(color,70)}"/>`;
  if (grade==='blue') horns = `<path d="M6.4 7.4C3.6 6 2.6 3.4 3.6.8c.6 2.4 2.2 4.2 4.4 5z" fill="${shadeHex(color,70)}"/><path d="M17.6 7.4C20.4 6 21.4 3.4 20.4.8c-.6 2.4-2.2 4.2-4.4 5z" fill="${shadeHex(color,70)}"/>`;
  const rivets = gearOrnaments(t, [[7,9.4],[17,9.4],[7,16.6],[17,16.6]], color, [12,9.6]);
  return svgIcon(rarityBackdrop(t,color) + horns +
    `<path d="M4 15a8 8 0 0116 0v1H4z" fill="${base}"/><path d="M4 15a8 8 0 0116 0h-4a4 4 0 00-8 0z" fill="${shadeHex(base,35)}"/>` +
    `<rect x="3" y="16" width="18" height="2.6" rx="1.2" fill="${dark}"/>` +
    `<path d="M12 8.6c1.8 0 3.2.6 3.2 2v1.2h-2v6h-2.4v-6h-2v-1.2c0-1.4 1.4-2 3.2-2z" fill="${visor}"/>` +
    `<path d="M8 12.2h1.8M14.2 12.2H16" stroke="${visor}" stroke-width="1.5"/>` +
    rivets);
}
// armure : cuirasse cintrée avec épaulières, teintée par palier — redessinée le 2026-07-08 pour
// mieux lire comme une armure (col en V, taille marquée, panneaux abdominaux)
/** @param {string} color @param {string} grade. @returns {string} SVG de l'armure (cuirasse + épaulières), teintée par palier. */
function armorIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const base = (grade==='green'||grade==='blue') ? shadeHex(color,-95) : color;
  const dark = shadeHex(base,-40), line = shadeHex(base,-70), light = shadeHex(base,45);
  const epaulettes = grade==='grey' ? '' :
    `<path d="M7.4 4.6C4.8 5 3.4 6.6 3.2 9l2.8 1c.2-2 .6-3.8 1.4-5.4z" fill="${grade==='white'?light:shadeHex(base,25)}"/>` +
    `<path d="M16.6 4.6c2.6.4 4 2 4.2 4.4l-2.8 1c-.2-2-.6-3.8-1.4-5.4z" fill="${dark}"/>`;
  const rivets = gearOrnaments(t, [[9.5,8],[14.5,8],[9.8,14.6],[14.2,14.6]], color, [12,11.3]);
  return svgIcon(rarityBackdrop(t,color) + epaulettes +
    `<path d="M12 3l4.6 1.6c1 2.4.8 4.9.4 7.4-.4 3.5-2 6.6-5 7.8-3-1.2-4.6-4.3-5-7.8-.4-2.5-.6-5-.4-7.4z" fill="${base}"/>` +
    `<path d="M12 3l4.6 1.6c1 2.4.8 4.9.4 7.4-.4 3.5-2 6.6-5 7.8z" fill="${dark}"/>` +
    `<path d="M9.6 4.4c.8 1.6 4 1.6 4.8 0" fill="none" stroke="${line}" stroke-width=".8"/>` +
    `<path d="M12 6v13" stroke="${line}" stroke-width=".7"/>` +
    `<path d="M8.6 9.2c1.2 1 5.6 1 6.8 0M9 13c1.1.9 4.9.9 6 0" fill="none" stroke="${line}" stroke-width=".55"/>` +
    rivets);
}
// gants : moufle d'armure vue de dos avec doigts segmentés — redessinés le 2026-07-08 (griffes au
// vert/bleu, plus lisibles que l'ancien gantelet trop simple)
/** @param {string} color @param {string} grade. @returns {string} SVG des gants, teintés par palier (griffes au vert/bleu). */
function glovesIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const base = (grade==='green'||grade==='blue') ? shadeHex(color,-95) : color;
  const dark = shadeHex(base,-40), cuff = shadeHex(base,-70);
  let claws = '';
  if (grade === 'green') claws = `<path d="M6.9 11.7l-.9-2 1.1.6zM10.1 10.3l-.7-2.2 1.1.8zM13.3 9.9l.4-2.3.7 1zM16.5 11.2l1-1.9-.1 1.3z" fill="${shadeHex(color,60)}"/>`;
  if (grade === 'blue') claws = `<path d="M6.9 11.7l-1.4-3 1.6 1zM10.1 10.3l-1-3.2 1.5 1.2zM13.3 9.9l.6-3.3 1 1.5zM16.5 11.2l1.6-2.8-.2 1.9z" fill="${shadeHex(color,70)}"/>`;
  const rivets = gearOrnaments(t, [[9.2,11.8],[14.8,11.8],[9.2,15.6],[14.8,15.6]], color, [12,13.7]);
  return svgIcon(rarityBackdrop(t,color) + claws +
    `<path d="M5.6 20.5V13a1.3 1.3 0 012.6 0v3h.6v-4.4a1.3 1.3 0 012.6 0V16h.6v-4.8a1.3 1.3 0 012.6 0V16h.6v-3.6a1.3 1.3 0 012.6 0v6c0 1.5-1.2 2.7-2.7 2.7H8.3c-1.5 0-2.7-1.2-2.7-2.6z" fill="${base}"/>` +
    `<path d="M5.6 20.5V13a1.3 1.3 0 012.6 0v7.4c0 .4-.1.7-.3 1-1.3-.1-2.3-1.2-2.3-1.9z" fill="${dark}"/>` +
    `<path d="M4.6 19.4h14.8l-.8 3.2H5.4z" fill="${cuff}"/>` +
    rivets);
}
// bottes : tige haute + pied, genouillère pointue au vert/bleu — redessinées le 2026-07-08
/** @param {string} color @param {string} grade. @returns {string} SVG des bottes, teintées par palier (genouillère pointue au vert/bleu). */
function bootsIconForColor(color, grade) {
  const t = JEWEL_TIER_IDX[grade] || 0;
  const base = (grade==='green'||grade==='blue') ? shadeHex(color,-95) : color;
  const dark = shadeHex(base,-40), sole = shadeHex(base,-80);
  let knee = '';
  if (grade==='green') knee = `<path d="M8.6 5.4L11.7 3l3.1 2.4-3.1 1.5z" fill="${dark}"/>`;
  if (grade==='blue') knee = `<path d="M8.6 5.4L11.7 2.6l3.1 2.8-3.1 1.5z" fill="${dark}"/><path d="M11.7 2.6V.9l1.5 1.9z" fill="${shadeHex(color,50)}"/>`;
  const spur = grade==='blue' ? `<path d="M7.5 18.2l-1.7-.9 1.7-.9z" fill="${color}"/>` : '';
  const trim = (grade==='green'||grade==='blue') ? `<path d="M9.4 12.4h4.4" stroke="${color}" stroke-width=".5"/>` : '';
  const rivets = gearOrnaments(t, [[10.4,9],[13,9],[10.4,12.4],[13,12.4]], color, [11.7,10.7]);
  return svgIcon(rarityBackdrop(t,color) + knee +
    `<path d="M9 4h5.5v9.8c0 .9.4 1.7 1.1 2.2l2.7 2c.7.5 1.1 1.3 1.1 2.2v1.4H9z" fill="${base}"/>` +
    `<path d="M14.5 4v9.8c0 .9.4 1.7 1.1 2.2l2.7 2c.7.5 1.1 1.3 1.1 2.2v1.4h-5V4z" fill="${dark}"/>` +
    `<ellipse cx="11.7" cy="5.2" rx="2.9" ry="1.4" fill="${sole}"/>` + trim + spur +
    `<path d="M8.4 21.6c-.5 0-.9-.4-.9-.9s.4-.9.9-.9h11.2c.5 0 .9.4.9.9s-.4.9-.9.9z" fill="${dark}"/>` +
    rivets);
}
// ceinture : sangle + boucle
const ICO_BELT = svgIcon(
  '<rect x="1.5" y="9.5" width="21" height="5" rx="1.4" fill="#5a3f22"/><rect x="1.5" y="9.5" width="21" height="2" rx="1" fill="#8a6a3a"/>' +
  '<rect x="8.5" y="7.5" width="7" height="9" rx="1.6" fill="none" stroke="#e6cf7a" stroke-width="2"/>' +
  '<rect x="11" y="9.5" width="2" height="5" rx="1" fill="#c9a55a"/>');
// artéfact : tablette runique ancienne, bronze/ambre avec une rune lumineuse gravée — nouveaux
// emplacements dédiés (2 slots, ex: Vell/Khan), demande explicite du 2026-07-07
const ICO_ARTIFACT = svgIcon(
  '<path d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" fill="#6e4a2a"/>' +
  '<path d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H12V3z" fill="#8a6038"/>' +
  '<circle cx="12" cy="11" r="3.4" fill="none" stroke="#e6cf7a" stroke-width="1.3"/>' +
  '<path d="M12 8.4l1.2 2.4-1.2 2.4-1.2-2.4z" fill="#ffe9a8"/>' +
  '<rect x="8" y="16.5" width="8" height="1.4" rx=".7" fill="#e6cf7a" opacity=".8"/>');
// pierre d'équipement (emplacement unique) : orbe sombre sertie dans une monture dorée, lueur
// intérieure — demande explicite du 2026-07-07
const ICO_EQSTONE = svgIcon(
  '<path d="M12 2.5c-4 3-7 4-7 9a7 7 0 0014 0c0-5-3-6-7-9z" fill="#7a5a2a"/>' +
  '<circle cx="12" cy="13" r="6" fill="#211c2c"/><circle cx="12" cy="13" r="6" fill="none" stroke="#c9a55a" stroke-width="1.3"/>' +
  '<circle cx="12" cy="13" r="3" fill="#8a54c9" opacity=".7"/><circle cx="10.4" cy="11.2" r="1.1" fill="#fff" opacity=".8"/>');

// ---- bijoux (jackpot) : progression visuelle par palier de stuff — demande explicite du
// 2026-07-07 : "les premiers bijoux auront des simples anneaux, puis des diamants, puis plusieurs
// diamants arrivé au stuff ultime orné de diamants et de couleur". tierIdx : 0=gris/blanc (anneau
// nu), 1=vert (un diamant), 2=bleu (plusieurs diamants + couleur du palier), 3=palier ultime
// (jaune/orange/rouge, pas encore en jeu — orné, plus gros, couleur dominante).
/** @param {number} tierIdx - 0=anneau nu, 1=un diamant, 2=plusieurs diamants+couleur, 3+=palier ultime (halo, plus gros). @param {string} color @param {number} cx @param {number} cy - centre du cluster. @returns {string} SVG de la progression visuelle de bijou par palier. */
function jewelGemCluster(tierIdx, color, cx, cy) {
  if (tierIdx <= 0) return '';
  if (tierIdx === 1) return `<path d="M${cx} ${cy-3.5}l2 3-2 3-2-3z" fill="#bfe4ff"/><path d="M${cx} ${cy-3.5}l2 3-2 3z" fill="#8cc8ff"/>`;
  if (tierIdx === 2) return `<path d="M${cx} ${cy-4}l2.1 3.2-2.1 3.2-2.1-3.2z" fill="#eaf6ff"/><path d="M${cx} ${cy-4}l2.1 3.2-2.1 3.2z" fill="${color}"/>` +
      `<path d="M${cx-3.4} ${cy-1.2}l1.1 1.7-1.1 1.7-1.1-1.7z" fill="${color}" opacity=".85"/>` +
      `<path d="M${cx+3.4} ${cy-1.2}l1.1 1.7-1.1 1.7-1.1-1.7z" fill="${color}" opacity=".85"/>`;
  // palier ultime : encore plus gros, halo de couleur
  return `<circle cx="${cx}" cy="${cy}" r="6" fill="${color}" opacity=".22"/>` +
      `<path d="M${cx} ${cy-4.6}l2.4 3.6-2.4 3.6-2.4-3.6z" fill="#fff" opacity=".95"/><path d="M${cx} ${cy-4.6}l2.4 3.6-2.4 3.6z" fill="${color}"/>` +
      `<path d="M${cx-4} ${cy-1.4}l1.3 2-1.3 2-1.3-2z" fill="${color}"/><path d="M${cx+4} ${cy-1.4}l1.3 2-1.3 2-1.3-2z" fill="${color}"/>`;
}
// bague / collier / boucles d'oreille redessinés le 2026-07-08 (cohérence avec le reste du set) —
// même règle d'ornements que les armes/armure : 0 au gris/blanc, 4 rivets au vert, 4 gemmes + 1
// losange (5e ornement) au bleu (voir gearOrnaments) ; le tierIdx (0/1/2) reste celui de
// JEWEL_TIER_IDX, la couleur elle-même distingue déjà gris de blanc
/** @param {number} tierIdx - JEWEL_TIER_IDX. @param {string} color. @returns {string} SVG de l'anneau, progression visuelle par palier (voir jewelGemCluster/gearOrnaments). */
function ringIconForTier(tierIdx, color) {
  // contour dans la couleur du palier (2026-07-08, demande explicite : "contour des bijou =
  // couleurs de la zone") -- remplace l'ancien contour sombre/noir au vert et au bleu
  const band = color;
  const bandLine = tierIdx<=0 ? shadeHex(color,-15) : shadeHex(color,60);
  let gem = '';
  if (tierIdx<=0) gem = `<rect x="10.6" y="6.6" width="2.8" height="2.4" rx=".7" fill="${shadeHex(color,-30)}"/>`;
  else if (tierIdx===1) gem = `<path d="M12 4.2l2 2.4-2 3-2-3z" fill="${color}"/><path d="M12 4.2l2 2.4-2 3z" fill="${shadeHex(color,-40)}"/>`;
  else gem = `<path d="M12 3.4l2.4 2.8-2.4 3.6-2.4-3.6z" fill="${shadeHex(color,70)}"/><path d="M12 3.4l2.4 2.8-2.4 3.6z" fill="${color}"/>`;
  const rivets = gearOrnaments(tierIdx, [[6.9,10.5],[17.1,10.5],[6.9,17.5],[17.1,17.5]], color, [12,20.8]);
  return svgIcon(rarityBackdrop(tierIdx,color) +
    `<circle cx="12" cy="14" r="6" fill="none" stroke="${band}" stroke-width="2.4"/>` +
    `<circle cx="12" cy="14" r="6" fill="none" stroke="${bandLine}" stroke-width=".9"/>` +
    gem + rivets);
}
/** @param {number} tierIdx - JEWEL_TIER_IDX. @param {string} color. @returns {string} SVG du collier, progression visuelle par palier. */
function necklaceIconForTier(tierIdx, color) {
  const chain = color;
  let pend = '';
  if (tierIdx<=0) pend = `<circle cx="12" cy="16.5" r="1.6" fill="${shadeHex(color,-30)}"/>`;
  else if (tierIdx===1) pend = `<path d="M12 13l3.4 4-3.4 4.4L8.6 17z" fill="${color}"/><path d="M12 13l3.4 4-3.4 4.4z" fill="${shadeHex(color,-40)}"/><path d="M12 15l1.6 2-1.6 2.2-1.6-2.2z" fill="${shadeHex(color,60)}"/>`;
  else pend = `<path d="M12 12.6l3.8 4.4-3.8 4.8-3.8-4.8z" fill="${color}"/><path d="M12 12.6l3.8 4.4-3.8 4.8z" fill="${shadeHex(color,-40)}"/><path d="M12 14.6l1.9 2.4-1.9 2.6-1.9-2.6z" fill="#eaf6ff"/><path d="M12 14.6l1.9 2.4-1.9 2.6z" fill="${shadeHex(color,60)}"/>`;
  const rivets = gearOrnaments(tierIdx, [[12,13.6],[8.9,17],[15.1,17],[12,20.6]], color, [17.2,13.8]);
  return svgIcon(rarityBackdrop(tierIdx,color) +
    `<path d="M4 5c0 6.5 4 10 8 10s8-3.5 8-10" fill="none" stroke="${chain}" stroke-width="1.8"/>` +
    `<path d="M4 5c0 6.5 4 10 8 10" fill="none" stroke="${tierIdx<=0?shadeHex(chain,40):shadeHex(chain,60)}" stroke-width="1.8"/>` +
    pend + rivets);
}
/** @param {number} tierIdx - JEWEL_TIER_IDX. @param {string} color. @returns {string} SVG des boucles d'oreille (paire), progression visuelle par palier. */
function earringIconForTier(tierIdx, color) {
  const ring = color;
  let drop = '', drop2 = '';
  if (tierIdx<=0) { drop = `<circle cx="8" cy="13.5" r="1.4" fill="${shadeHex(color,-30)}"/>`; drop2 = `<circle cx="16" cy="13.5" r="1.4" fill="${shadeHex(color,-30)}"/>`; }
  else if (tierIdx===1) {
    drop = `<path d="M8 10.8l1.6 2.4-1.6 3.2-1.6-2.8z" fill="${shadeHex(color,-40)}"/><path d="M8 11.8l.9 1.4-.9 1.6-.9-1.6z" fill="${color}"/>`;
    drop2 = `<path d="M16 10.8l1.6 2.4-1.6 3.2-1.6-2.8z" fill="${shadeHex(color,-40)}"/><path d="M16 11.8l.9 1.4-.9 1.6-.9-1.6z" fill="${color}"/>`;
  } else {
    drop = `<path d="M8 10.4l1.8 2.7-1.8 3.3-1.8-3.3z" fill="${shadeHex(color,-40)}"/><path d="M8 11.6l1 1.5-1 1.9-1-1.9z" fill="#eaf6ff"/><path d="M8 11.6l1 1.5-1 1.9z" fill="${shadeHex(color,60)}"/>`;
    drop2 = `<path d="M16 10.4l1.8 2.7-1.8 3.3-1.8-3.3z" fill="${shadeHex(color,-40)}"/><path d="M16 11.6l1 1.5-1 1.9-1-1.9z" fill="#eaf6ff"/><path d="M16 11.6l1 1.5-1 1.9z" fill="${shadeHex(color,60)}"/>`;
  }
  const rivets = gearOrnaments(tierIdx, [[6.2,9],[9.8,9],[14.2,9],[17.8,9]], color, [12,5.6]);
  return svgIcon(rarityBackdrop(tierIdx,color) +
    `<circle cx="8" cy="7" r="2.6" fill="none" stroke="${ring}" stroke-width="1.5"/>` +
    `<circle cx="16" cy="7" r="2.6" fill="none" stroke="${ring}" stroke-width="1.5"/>` +
    drop + drop2 + rivets);
}
// ceinture redessinée le 2026-07-08 (demande explicite, même style que le reste du set) : sangle
// teintée par palier, boucle au contour dans la couleur de la zone (comme bague/collier/boucles
// d'oreille), même règle de rivets/gemmes que le reste (voir gearOrnaments)
/** @param {number} tierIdx - JEWEL_TIER_IDX. @param {string} color. @returns {string} SVG de la ceinture, progression visuelle par palier. */
function beltIconForTier(tierIdx, color) {
  const strap = tierIdx<=0 ? color : shadeHex(color,-90);
  const strapLine = tierIdx<=0 ? shadeHex(color,60) : shadeHex(color,60);
  let buckle = '';
  if (tierIdx<=0) buckle = `<rect x="11" y="9.5" width="2" height="5" rx="1" fill="${shadeHex(color,-30)}"/>`;
  else if (tierIdx===1) buckle = `<path d="M11.7 9.4l1.3 2-1.3 2-1.3-2z" fill="${color}"/>`;
  else buckle = `<path d="M11.7 8.8l1.5 2.3-1.5 2.3-1.5-2.3z" fill="${shadeHex(color,60)}"/><path d="M11.7 8.8l1.5 2.3-1.5 2.3z" fill="${color}"/>`;
  const rivets = gearOrnaments(tierIdx, [[4.5,12],[19.5,12],[9,11.2],[15,11.2]], color, [11.7,15.5]);
  return svgIcon(rarityBackdrop(tierIdx,color) +
    `<rect x="1.5" y="9.5" width="21" height="5" rx="1.4" fill="${strap}"/><rect x="1.5" y="9.5" width="21" height="1.6" rx=".8" fill="${strapLine}"/>` +
    `<rect x="8.5" y="7.5" width="7" height="9" rx="1.6" fill="none" stroke="${color}" stroke-width="2"/>` +
    buckle + rivets);
}
// convertit un grade GEAR_TIERS ('grey'/'white'/'green'/'blue') en tierIdx de richesse visuelle
// (gris+blanc = "simples anneaux", même palier visuel — voir demande utilisateur)
const JEWEL_TIER_IDX = { grey:0, white:0, green:1, blue:2 };

// pierres d'optimisation — création originale inspirée du style "pierre à facettes" de Black
// Desert, sans reprendre d'assets réels (demande du 2026-07-05)
// Pierre de Novice : moellon brut gris, à peine dégrossi
const ICO_MAT_NOVICE = svgIcon(
  '<path d="M12 3l6 4.5-2 8-4 6-4-6-2-8z" fill="#a8a8a4"/><path d="M12 3l6 4.5-2 8-4 6z" fill="#878782"/>' +
  '<path d="M12 3l-2 7.2 4 1.1z" fill="#c6c6c0"/>');
// Pierre du Temps : cristal bleu pâle, facette centrale évoquant un sablier
const ICO_MAT_TEMPS = svgIcon(
  '<path d="M12 2l5.4 5-2 9-3.4 6-3.4-6-2-9z" fill="#cfd8dc"/><path d="M12 2l5.4 5-2 9-3.4 6z" fill="#a3b8c1"/>' +
  '<path d="M12 2l-2 7.2 4 1.1z" fill="#eef6f8"/><path d="M10.3 12.5h3.4l-1.7 3-1.7-3z" fill="#6f9aa8" opacity=".55"/>');
// Pierre Noire : jade à facettes avec lueur verte au coeur (recolorée en vert le 2026-07-08,
// demande explicite — cohérent avec le palier Yuria/vert qu'elle sert à optimiser)
const ICO_MAT_NOIRE = svgIcon(
  '<path d="M12 1l6 6-3 9-3 7-3-7-3-9z" fill="#1e3d24"/><path d="M12 1l6 6-3 9-3 7z" fill="#142b19"/>' +
  '<path d="M12 1l-3 7.2 3 1.4 3-1.4z" fill="#7aa35e"/><circle cx="12" cy="12" r="2.1" fill="#7aa35e" opacity=".65"/>');
// Pierre de Caphras : relique ambrée fissurée, lueur dorée
const ICO_MAT_CAPHRAS = svgIcon(
  '<path d="M12 2l5.6 4.6-1.6 9.4-4 6-4-6-1.6-9.4z" fill="#c9a55a"/><path d="M12 2l5.6 4.6-1.6 9.4-4 6z" fill="#a3803c"/>' +
  '<path d="M12 2l-2 8 4 1.1z" fill="#e8d29c"/><circle cx="12" cy="13.5" r="1.6" fill="#ffe9a8" opacity=".7"/>');
// Pierre concentrée (palier Grunil/bleu, distincte de la Pierre Noire de Yuria depuis le
// 2026-07-06) : cristal bleu foncé dense, cœur cyan concentré
const ICO_MAT_CONCENTREE = svgIcon(
  '<path d="M12 2l5.8 4.8-1.8 9.6-4 5.6-4-5.6-1.8-9.6z" fill="#2e3a52"/><path d="M12 2l5.8 4.8-1.8 9.6-4 5.6z" fill="#1c2438"/>' +
  '<path d="M12 2l-2 7.4 4 1.2z" fill="#4a5c7a"/><circle cx="12" cy="13" r="2.3" fill="#5ec9e8" opacity=".65"/>');
// Pierre de Cron : orbe turquoise lumineux façon perle (redessiné le 2026-07-06, demande explicite,
// références visuelles fournies) — protège un enchantement d'une rétrogradation en cas d'échec
// (au choix du joueur depuis V193, voir attemptEnhance/S.useCronStone). Dropée dans TOUTES les
// zones du jeu à un taux fixe (voir CRON_STONE.ch), sans lien avec le palier de stuff.
const ICO_CRON_STONE = svgIcon(
  '<circle cx="12" cy="12" r="9.5" fill="#1f7a72"/><circle cx="12" cy="12" r="9.5" fill="#4ecdc4" opacity=".5"/>' +
  '<path d="M7 15c1.8 1.4 3.4.6 4.6-1s3.2-2.4 5-1" stroke="#eafffa" stroke-width="1.1" fill="none" opacity=".4" stroke-linecap="round"/>' +
  '<path d="M6.5 6.5c1.8 2.6.8 5-.8 6.8s-.4 4.2 2.4 4.2 4.6-2.4 5.4-5-.6-5.4-2.6-6.4-2.6-1.8-4.4.4z" fill="#eafffa" opacity=".35"/>' +
  '<ellipse cx="9" cy="7.5" rx="3.1" ry="2.1" fill="#fff" opacity=".75"/>' +
  '<circle cx="12" cy="12" r="9.5" fill="none" stroke="#bff2ea" stroke-width=".6" opacity=".5"/>');
// ch centralisé ici (2026-07-06, corrige un bug d'affichage : la table de loot avait un 0.001
// codé en dur, resté à l'ancien taux après le passage à 1% le 2026-07-06 — une seule source de
// vérité désormais, utilisée à la fois par le tirage réel et par son affichage)
const CRON_STONE = { name:'Pierre de Cron', key:'mat_cron_stone', icon:ICO_CRON_STONE, color:'#4ecdc4', ch:0.01 };
// coût en Pierres de Cron par palier de la pièce protégée (2026-07-15, demande explicite : "pierre
// de cron utilisation gris 1 blanc 2 vert 3 bleu 4") -- avant, une protection coûtait toujours 1
// pierre quel que soit le palier de l'objet. Voir cronStoneCostForItem/attemptEnhance.
const CRON_STONE_COST_BY_TIER = { grey:1, white:2, green:3, blue:4 };
// coût pour protéger CET objet (déduit de sa couleur de palier, comme itemTierIdx) -- 1 par défaut
// si la couleur ne correspond à aucun palier connu (filet de sécurité, ne devrait pas arriver)
/** @param {object} item - lit .color pour déduire son palier (comme itemTierIdx). @returns {number} coût en Pierres de Cron pour protéger cet objet (1 par défaut si palier inconnu). */
function cronStoneCostForItem(item) {
  if (!item) return 1;
  const tier = GEAR_TIERS.find(t => t.color === item.color);
  return tier ? (CRON_STONE_COST_BY_TIER[tier.grade] || 1) : 1;
}
// Coeur de Vell : cœur stylisé bleu abyssal, lueur cyan pulsante — récompense rare du boss Vell
const ICO_COEUR_VELL = svgIcon(
  '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6.5 5.5 5.5 0 0121.5 12c-2.5 4.5-9.5 9-9.5 9z" fill="#2a5a78"/>' +
  '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6.5z" fill="#1c4058"/>' +
  '<circle cx="12" cy="13" r="2.6" fill="#5ec9e8" opacity=".8"/>');
