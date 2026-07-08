// ==== src/inventory/gear-icons.js ====
function svgIcon(inner) { return `<svg class="gicon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`; }

const ICO_BOOK = svgIcon(
  '<path d="M4 4.5c3-1.2 5.5-1 8 .5v15c-2.5-1.5-5-1.7-8-.5z" fill="#3a6ea8"/>' +
  '<path d="M20 4.5c-3-1.2-5.5-1-8 .5v15c2.5-1.5 5-1.7 8-.5z" fill="#5a8fc8"/>' +
  '<path d="M12 5v15" stroke="#274a6e" stroke-width="1.4"/><path d="M14 8h4M14 11h4M6 8h4M6 11h4" stroke="#dfeaf5" stroke-width="0.9"/>');

function shadeHex(hex, amt) {
  const h = hex.replace('#','');
  const num = parseInt(h.length===3 ? h.split('').map(c=>c+c).join('') : h, 16);
  let r = (num>>16) + amt, g = ((num>>8)&0xff) + amt, b = (num&0xff) + amt;
  r = Math.max(0,Math.min(255,r)); g = Math.max(0,Math.min(255,g)); b = Math.max(0,Math.min(255,b));
  return '#' + ((1<<24) + (r<<16) + (g<<8) + b).toString(16).slice(1);
}

function rarityBackdrop(tierIdx, color) {
  if (tierIdx === 1) return `<rect x="1" y="1" width="22" height="22" rx="4" fill="${color}" opacity=".14"/>` +
    `<path d="M2 6.5l4.5-4.5M22 6.5l-4.5-4.5M2 17.5l4.5 4.5M22 17.5l-4.5 4.5" stroke="${color}" stroke-width="1" opacity=".5"/>`;
  if (tierIdx >= 2) return `<rect x="1" y="1" width="22" height="22" rx="4" fill="${color}" opacity=".18"/>` +
    `<path d="M2 7.5l5.5-5.5M22 7.5l-5.5-5.5M2 16.5l5.5 5.5M22 16.5l-5.5 5.5" stroke="${color}" stroke-width="1.2" opacity=".65"/>` +
    `<path d="M12 .3l1.5 1.9-1.5 1.9-1.5-1.9z" fill="${color}" opacity=".7"/><path d="M12 23.7l1.5-1.9-1.5-1.9-1.5 1.9z" fill="${color}" opacity=".7"/>`;
  return '';
}

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

const ICO_BELT = svgIcon(
  '<rect x="1.5" y="9.5" width="21" height="5" rx="1.4" fill="#5a3f22"/><rect x="1.5" y="9.5" width="21" height="2" rx="1" fill="#8a6a3a"/>' +
  '<rect x="8.5" y="7.5" width="7" height="9" rx="1.6" fill="none" stroke="#e6cf7a" stroke-width="2"/>' +
  '<rect x="11" y="9.5" width="2" height="5" rx="1" fill="#c9a55a"/>');

const ICO_ARTIFACT = svgIcon(
  '<path d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" fill="#6e4a2a"/>' +
  '<path d="M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H12V3z" fill="#8a6038"/>' +
  '<circle cx="12" cy="11" r="3.4" fill="none" stroke="#e6cf7a" stroke-width="1.3"/>' +
  '<path d="M12 8.4l1.2 2.4-1.2 2.4-1.2-2.4z" fill="#ffe9a8"/>' +
  '<rect x="8" y="16.5" width="8" height="1.4" rx=".7" fill="#e6cf7a" opacity=".8"/>');

const ICO_EQSTONE = svgIcon(
  '<path d="M12 2.5c-4 3-7 4-7 9a7 7 0 0014 0c0-5-3-6-7-9z" fill="#7a5a2a"/>' +
  '<circle cx="12" cy="13" r="6" fill="#211c2c"/><circle cx="12" cy="13" r="6" fill="none" stroke="#c9a55a" stroke-width="1.3"/>' +
  '<circle cx="12" cy="13" r="3" fill="#8a54c9" opacity=".7"/><circle cx="10.4" cy="11.2" r="1.1" fill="#fff" opacity=".8"/>');

function jewelGemCluster(tierIdx, color, cx, cy) {
  if (tierIdx <= 0) return '';
  if (tierIdx === 1) return `<path d="M${cx} ${cy-3.5}l2 3-2 3-2-3z" fill="#bfe4ff"/><path d="M${cx} ${cy-3.5}l2 3-2 3z" fill="#8cc8ff"/>`;
  if (tierIdx === 2) return `<path d="M${cx} ${cy-4}l2.1 3.2-2.1 3.2-2.1-3.2z" fill="#eaf6ff"/><path d="M${cx} ${cy-4}l2.1 3.2-2.1 3.2z" fill="${color}"/>` +
      `<path d="M${cx-3.4} ${cy-1.2}l1.1 1.7-1.1 1.7-1.1-1.7z" fill="${color}" opacity=".85"/>` +
      `<path d="M${cx+3.4} ${cy-1.2}l1.1 1.7-1.1 1.7-1.1-1.7z" fill="${color}" opacity=".85"/>`;
  
  return `<circle cx="${cx}" cy="${cy}" r="6" fill="${color}" opacity=".22"/>` +
      `<path d="M${cx} ${cy-4.6}l2.4 3.6-2.4 3.6-2.4-3.6z" fill="#fff" opacity=".95"/><path d="M${cx} ${cy-4.6}l2.4 3.6-2.4 3.6z" fill="${color}"/>` +
      `<path d="M${cx-4} ${cy-1.4}l1.3 2-1.3 2-1.3-2z" fill="${color}"/><path d="M${cx+4} ${cy-1.4}l1.3 2-1.3 2-1.3-2z" fill="${color}"/>`;
}

function ringIconForTier(tierIdx, color) {
  
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

const JEWEL_TIER_IDX = { grey:0, white:0, green:1, blue:2 };

const ICO_MAT_NOVICE = svgIcon(
  '<path d="M12 3l6 4.5-2 8-4 6-4-6-2-8z" fill="#a8a8a4"/><path d="M12 3l6 4.5-2 8-4 6z" fill="#878782"/>' +
  '<path d="M12 3l-2 7.2 4 1.1z" fill="#c6c6c0"/>');

const ICO_MAT_TEMPS = svgIcon(
  '<path d="M12 2l5.4 5-2 9-3.4 6-3.4-6-2-9z" fill="#cfd8dc"/><path d="M12 2l5.4 5-2 9-3.4 6z" fill="#a3b8c1"/>' +
  '<path d="M12 2l-2 7.2 4 1.1z" fill="#eef6f8"/><path d="M10.3 12.5h3.4l-1.7 3-1.7-3z" fill="#6f9aa8" opacity=".55"/>');

const ICO_MAT_NOIRE = svgIcon(
  '<path d="M12 1l6 6-3 9-3 7-3-7-3-9z" fill="#1e3d24"/><path d="M12 1l6 6-3 9-3 7z" fill="#142b19"/>' +
  '<path d="M12 1l-3 7.2 3 1.4 3-1.4z" fill="#7aa35e"/><circle cx="12" cy="12" r="2.1" fill="#7aa35e" opacity=".65"/>');

const ICO_MAT_CAPHRAS = svgIcon(
  '<path d="M12 2l5.6 4.6-1.6 9.4-4 6-4-6-1.6-9.4z" fill="#c9a55a"/><path d="M12 2l5.6 4.6-1.6 9.4-4 6z" fill="#a3803c"/>' +
  '<path d="M12 2l-2 8 4 1.1z" fill="#e8d29c"/><circle cx="12" cy="13.5" r="1.6" fill="#ffe9a8" opacity=".7"/>');

const ICO_MAT_CONCENTREE = svgIcon(
  '<path d="M12 2l5.8 4.8-1.8 9.6-4 5.6-4-5.6-1.8-9.6z" fill="#2e3a52"/><path d="M12 2l5.8 4.8-1.8 9.6-4 5.6z" fill="#1c2438"/>' +
  '<path d="M12 2l-2 7.4 4 1.2z" fill="#4a5c7a"/><circle cx="12" cy="13" r="2.3" fill="#5ec9e8" opacity=".65"/>');

const ICO_CRON_STONE = svgIcon(
  '<circle cx="12" cy="12" r="9.5" fill="#1f7a72"/><circle cx="12" cy="12" r="9.5" fill="#4ecdc4" opacity=".5"/>' +
  '<path d="M7 15c1.8 1.4 3.4.6 4.6-1s3.2-2.4 5-1" stroke="#eafffa" stroke-width="1.1" fill="none" opacity=".4" stroke-linecap="round"/>' +
  '<path d="M6.5 6.5c1.8 2.6.8 5-.8 6.8s-.4 4.2 2.4 4.2 4.6-2.4 5.4-5-.6-5.4-2.6-6.4-2.6-1.8-4.4.4z" fill="#eafffa" opacity=".35"/>' +
  '<ellipse cx="9" cy="7.5" rx="3.1" ry="2.1" fill="#fff" opacity=".75"/>' +
  '<circle cx="12" cy="12" r="9.5" fill="none" stroke="#bff2ea" stroke-width=".6" opacity=".5"/>');

const CRON_STONE = { name:'Pierre de Cron', key:'mat_cron_stone', icon:ICO_CRON_STONE, color:'#4ecdc4', ch:0.01 };

const CRON_STONE_COST_BY_TIER = { grey:1, white:2, green:3, blue:4 };

function cronStoneCostForItem(item) {
  if (!item) return 1;
  const tier = GEAR_TIERS.find(t => t.color === item.color);
  return tier ? (CRON_STONE_COST_BY_TIER[tier.grade] || 1) : 1;
}

const ICO_COEUR_VELL = svgIcon(
  '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6.5 5.5 5.5 0 0121.5 12c-2.5 4.5-9.5 9-9.5 9z" fill="#2a5a78"/>' +
  '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6.5z" fill="#1c4058"/>' +
  '<circle cx="12" cy="13" r="2.6" fill="#5ec9e8" opacity=".8"/>');

// ==== src/world/zones-data.js ====
const ZONES = [
  
  { name:'Camp des Loups', tier:'Balenos — Early', reqAP:6, reqDP:14, gearBasisAP:20, gearBasisDP:19, mob:'Loup',
    hpPer:23, dmg:3, xp:8,
    tint:{ a:'#3a4a31', b:'#36452e', dry:'#414f33' }, tones:['#6b5f52','#5a5248','#75685a'], alphaTone:'#3d3a45',
    loot:{ trash:{name:'Viande de loup',val:1,ch:1}, mat:{name:'Pierre noire',val:1,ch:.55},
      jackpot:{name:'Anneau Naru',val:290,ch:.006,ap:1}, craft:{name:'Poussière d\'esprit ancien',ch:.03} } },
  { name:'Ruines de Protty', tier:'Balenos — Early', reqAP:20, reqDP:19, mob:'Esprit de Protty',
    hpPer:26, dmg:3, xp:12,
    tint:{ a:'#4a4231', b:'#453e2e', dry:'#4f4833' }, tones:['#a5543c','#8f4a38','#b06045'], alphaTone:'#6e2f24',
    loot:{ trash:{name:'Lame rouillée d\'Imp',val:3,ch:1}, mat:{name:'Pierre noire',val:1,ch:.48},
      jackpot:{name:'Collier Naru',val:550,ch:.005,ap:1}, craft:{name:'Poussière d\'esprit ancien',ch:.026} } },
  { name:'Repaire des Pirates', tier:'Balenos — Early', reqAP:25, reqDP:23, mob:'Pirate',
    hpPer:31, dmg:4, xp:18,
    tint:{ a:'#4a4232', b:'#443c2d', dry:'#524936' }, tones:['#7a6248','#6b563e','#8a7055'], alphaTone:'#4a3a28',
    loot:{ trash:{name:'Insigne de Sausan',val:5,ch:1}, mat:{name:'Pierre noire',val:1,ch:.4},
      jackpot:{name:'Ceinture Naru',val:1025,ch:.0038,ap:1}, craft:{name:'Poussière d\'esprit ancien',ch:.022} } },
  
  { name:'Camp Rhutum', tier:'Serendia — Early', reqAP:40, reqDP:24, mob:'Guerrier Rhutum',
    hpPer:48, dmg:6, xp:27,
    tint:{ a:'#32383f', b:'#2d333a', dry:'#3a4147' }, tones:['#5a6a78','#4e5d6a','#687888'], alphaTone:'#33404d',
    loot:{ trash:{name:'Bourse de pirate',val:9,ch:1}, mat:{name:'Pierre noire',val:1,ch:.32},
      jackpot:{name:'Anneau Tuvala',val:1960,ch:.0028,ap:1}, craft:{name:'Poussière d\'esprit ancien',ch:.018} } },
  { name:'Ferme Shultz', tier:'Serendia — Early', reqAP:49, reqDP:30, mob:'Garde Shultz',
    hpPer:66, dmg:8, xp:40,
    tint:{ a:'#2f4038', b:'#2b3b33', dry:'#37473c' }, tones:['#4a7060','#3f6353','#568070'], alphaTone:'#2c4a3e',
    loot:{ trash:{name:'Croc de Naga',val:15,ch:1}, mat:{name:'Éclat de cristal noir tranchant',val:1,ch:.26},
      jackpot:{name:'Collier Tuvala',val:3375,ch:.002,ap:2}, craft:{name:'Poussière d\'esprit ancien',ch:.015} } },
  
  { name:'Colonie Sausan', tier:'Serendia — Mid', reqAP:62, reqDP:37, gearBasisDP:45, mob:'Combattant Sausan',
    hpPer:93, dmg:12, xp:60,
    tint:{ a:'#38452e', b:'#33402a', dry:'#3f4c33' }, tones:['#607a45','#546c3c','#6e8a50'], alphaTone:'#3c4e2a',
    loot:{ trash:{name:'Oreille de Fogan',val:24,ch:1}, mat:{name:'Éclat de cristal noir dur',val:4,ch:.2},
      jackpot:{name:'Ceinture Tuvala',val:5500,ch:.0015,ap:3}, craft:{name:'Poussière d\'esprit ancien',ch:.012} } },
  
  { name:'Mine de Fer Abandonnée', tier:'Serendia — Mid', reqAP:99, reqDP:54, mob:'Mineur corrompu',
    hpPer:156, dmg:19, xp:90,
    
    tint:{ a:'#4a3226', b:'#443023', dry:'#583c2c' }, tones:['#8a7a68','#7a6c5a','#988676'], alphaTone:'#5a6068',
    loot:{ trash:{name:'Fer rouillé',val:39,ch:1}, mat:{name:'Pierre de Caphras',val:11,ch:.15},
      jackpot:{name:'Anneau Asula',val:8900,ch:.0036,ap:2}, craft:{name:'Fragment de mémoire',ch:.009} } },
  { name:'Poste Helm', tier:'Serendia — Late', reqAP:122, reqDP:66, mob:'Soldat Helm',
    hpPer:233, dmg:29, xp:135,
    tint:{ a:'#403845', b:'#3a3340', dry:'#48404d' }, tones:['#6a5a80','#5c4e70','#786890'], alphaTone:'#3a2f52',
    loot:{ trash:{name:'Fourrure de Biraghi',val:56,ch:1}, mat:{name:'Pierre de Caphras',val:11,ch:.11},
      jackpot:{name:'Collier Asula',val:13000,ch:.00252,ap:4}, craft:{name:'Fragment de mémoire',ch:.007} } },
  { name:'Repaire Bandits Gahaz', tier:'Serendia — Late', reqAP:150, reqDP:82, mob:'Bandit Gahaz',
    hpPer:353, dmg:44, xp:200,
    tint:{ a:'#38452e', b:'#33402a', dry:'#3f4c33' }, tones:['#607a45','#546c3c','#6e8a50'], alphaTone:'#3c4e2a',
    loot:{ trash:{name:'Défense d\'orc',val:74,ch:1}, mat:{name:'Pierre de Caphras',val:9,ch:.08},
      jackpot:{name:'Ceinture Asula',val:17850,ch:.0018,ap:6}, craft:{name:'Fragment de mémoire',ch:.005} } },
  
  { name:'Sanctuaire Elric', tier:'Mediah — Early', reqAP:269, reqDP:101, mob:'Sectateur d\'Elric',
    hpPer:596, dmg:73, xp:300,
    tint:{ a:'#3d3545', b:'#383040', dry:'#453c4e' }, tones:['#7a6a9a','#6c5d8a','#8878aa'], alphaTone:'#4a3e62',
    
    loot:{ trash:{name:'Éclat de relique ancienne',val:90,ch:1}, mat:{name:'Pierre de Caphras',val:7,ch:.12},
      jackpot:{name:'Anneau de Cadry',val:24200,ch:.0012,ap:6}, craft:{name:'Marbre du Dieu déchu',ch:.0035} } },
  
  { name:'Ruines de Kratuga', tier:'Mediah — Early', reqAP:286, reqDP:129, mob:'Uluan',
    hpPer:894, dmg:110, xp:450,
    tint:{ a:'#4a3d30', b:'#44382c', dry:'#524436' }, tones:['#b09060','#a08252','#c0a070'], alphaTone:'#6e5636',
    loot:{ trash:{name:'Relique d\'Hystria',val:105,ch:1}, mat:{name:'Pierre de Caphras',val:6,ch:.09},
      jackpot:{name:'Serap\'s Necklace',val:29600,ch:.0008,ap:9}, craft:{name:'Marbre du Dieu déchu',ch:.0025} } },
  
  { name:'Planque des Mânes', tier:'Mediah — Early', reqAP:303, reqDP:129, mob:'Esprit des Mânes',
    hpPer:1000, dmg:125, xp:500,
    tint:{ a:'#3a3f4a', b:'#343943', dry:'#40454f' }, tones:['#8a9ab0','#7c8ca2','#98a8c0'], alphaTone:'#4a5568',
    loot:{ trash:{name:'Larme de Mâne',val:120,ch:1}, mat:{name:'Pierre de Caphras',val:5,ch:.07},
      jackpot:{name:'Orkinrad\'s Belt',val:35000,ch:.0006,ap:10}, craft:{name:'Marbre du Dieu déchu',ch:.0018} } },
  
  { name:'Ruines de Trent', tier:'Balenos — Early', reqAP:30, reqDP:24, mob:'Troll des Ruines',
    hpPer:35, dmg:4, xp:20,
    tint:{ a:'#3d4238', b:'#383d33', dry:'#454a3e' }, tones:['#6a7a5e','#5c6c50','#788a6c'], alphaTone:'#455038',
    loot:{ trash:{name:'Pierre de Trent',val:7,ch:1}, mat:{name:'Pierre noire',val:1,ch:.34},
      jackpot:{name:'Boucle Naru',val:1300,ch:.0032,ap:1}, craft:{name:'Poussière d\'esprit ancien',ch:.019} } },
  { name:'Île d\'Iliya', tier:'Serendia — Mid', reqAP:75, reqDP:44, mob:'Pirate d\'Iliya',
    hpPer:104, dmg:13, xp:67,
    tint:{ a:'#2e4a4a', b:'#2a4444', dry:'#355656' }, tones:['#4a9a9a', '#3f8888', '#5aacac'], alphaTone:'#2c5a5a',
    loot:{ trash:{name:'Perle d\'Iliya',val:38,ch:1}, mat:{name:'Éclat de cristal noir dur',val:5,ch:.14},
      jackpot:{name:'Boucle Tuvala',val:6900,ch:.0011,ap:3}, craft:{name:'Poussière d\'esprit ancien',ch:.009} } },
  { name:'Base de Bashim', tier:'Serendia — Late', reqAP:168, reqDP:91, mob:'Soldat de Bashim',
    hpPer:395, dmg:49, xp:224,
    tint:{ a:'#3c3c34', b:'#36362f', dry:'#44443a' }, tones:['#8a8a68', '#78785a', '#9a9a78'], alphaTone:'#565640',
    loot:{ trash:{name:'Insigne de Bashim',val:92,ch:1}, mat:{name:'Pierre de Caphras',val:8,ch:.058},
      jackpot:{name:'Boucle Asula',val:22300,ch:.00126,ap:9}, craft:{name:'Fragment de mémoire',ch:.003} } },
  
  { name:'Forêt de Polly', tier:'Mediah — Early', reqAP:320, reqDP:170, mob:'Troll de Polly',
    hpPer:1120, dmg:140, xp:560,
    tint:{ a:'#25382c', b:'#213228', dry:'#2c4034' }, tones:['#3f6e50', '#356045', '#4a805c'], alphaTone:'#274a34',
    loot:{ trash:{name:'Mousse de Polly',val:135,ch:1}, mat:{name:'Pierre de Caphras',val:4,ch:.055},
      jackpot:{name:'Tungrad\'s Earring',val:38500,ch:.00044,ap:11}, craft:{name:'Marbre du Dieu déchu',ch:.0013} } },
];

// ==== src/world/gear-tiers-data.js ====
const GEAR_TIERS = [
  
  { grade:'grey', color:'#b8b8b8', zones:[0,1,2,12], label:{fr:'Gris — Naru',en:'Grey — Naru'},
    sets:{ weapon:'Bâton Naru', awakening:'Éveil Naru', secondary:'Dague Naru',
           helmet:'Casque Naru', armor:'Armure Naru', gloves:'Gants Naru', boots:'Bottes Naru' },
    material:{ name:'Pierre de Novice', icon:ICO_MAT_NOVICE, color:'#b8b8b8' }, dropChance:null },
  { grade:'white', color:'#e8e8e8', zones:[3,4,5,13], label:{fr:'Blanc — Tuvala',en:'White — Tuvala'},
    sets:{ weapon:'Bâton Tuvala', awakening:'Éveil Tuvala', secondary:'Dague Tuvala',
           helmet:'Casque Tuvala', armor:'Armure Tuvala', gloves:'Gants Tuvala', boots:'Bottes Tuvala' },
    material:{ name:'Pierre du Temps', icon:ICO_MAT_TEMPS, color:'#cfd8dc' }, dropChance:null },
  { grade:'green', color:'#7aa35e', zones:[6,7,8,14], label:{fr:'Vert — Yuria',en:'Green — Yuria'},
    sets:{ weapon:'Bâton Yuria', awakening:'Éveil Yuria', secondary:'Dague Yuria',
           helmet:'Casque Yuria', armor:'Plastron Yuria', gloves:'Gants Yuria', boots:'Bottes Yuria' },
    material:{ name:'Pierre Noire', icon:ICO_MAT_NOIRE, color:'#7aa35e' }, dropChance:0.02 }, 
  { grade:'blue', color:'#6ea3c9', zones:[9,10,11,15], label:{fr:'Bleu — Grunil',en:'Blue — Grunil'},
    sets:{ weapon:'Bâton Grunil', awakening:'Éveil Grunil', secondary:'Dague Grunil',
           helmet:'Casque Grunil', armor:'Plastron Grunil', gloves:'Gants Grunil', boots:'Bottes Grunil' },
    
    material:{ name:'Pierre concentrée', icon:ICO_MAT_CONCENTREE, color:'#6ea3c9' }, dropChance:0.02 },
];
function gearTierForZone(zi) { return GEAR_TIERS.find(t => t.zones.includes(zi)) || GEAR_TIERS[GEAR_TIERS.length-1]; }

const GEAR_CHANCE = [.16,.12,.09,.065,.046,.032,.021,.014,.009,.0055,.0032,.0018,.065,.022,.0014,.0014];

const LOOT_RATES_V2 = {
  grey:  { gear:0.0576, jewel:0.0288 },
  white: { gear:0.0288, jewel:0.0144 },
  green: { gear:0.0144, jewel:0.0072 },
  blue:  { gear:0.0072, jewel:0.0036 },
};

function gearDropChance(tier, zi) {
  if (S.lootTableVersion === 'v2') return LOOT_RATES_V2[tier.grade].gear;
  return tier.dropChance != null ? tier.dropChance : (GEAR_CHANCE[zi] ?? .002);
}

function jewelDropChance(tier, v1FallbackCh) {
  if (S.lootTableVersion === 'v2') return LOOT_RATES_V2[tier.grade].jewel;
  return v1FallbackCh;
}

const GEAR_SLOTS = ['helmet','armor','gloves','boots'];

const ZONE_WEAPON_SLOTS = [
  ['weapon'], [], ['secondary'],                  
  [], ['weapon'], ['secondary'],                  
  [], ['weapon'], ['secondary'],                  
  [], ['weapon'], ['secondary'],                  
  
  ['awakening'],                                   
  ['awakening'],                                   
  ['awakening'],                                   
  ['awakening'],                                   
];

const ZONE_ARMOR_SLOTS = [
  ['helmet'], ['armor'], ['gloves'],              
  ['helmet'], ['armor'], ['gloves'],              
  ['helmet'], ['armor'], ['gloves'],              
  ['helmet'], ['armor'], ['gloves'],              
  ['boots'],                                       
  ['boots'],                                       
  ['boots'],                                       
  ['boots'],                                       
];

const GEAR_ROLE = {
  weapon:     { apShare:0.1139, dpShare:0,      hpShare:0,    dodgeShare:0 },
  awakening:  { apShare:0.1491, dpShare:0,      hpShare:0,    dodgeShare:0 },
  secondary:  { apShare:0.0813, dpShare:0,      hpShare:0,    dodgeShare:0 },
  helmet:     { apShare:0,      dpShare:0.1272, hpShare:0.30, dodgeShare:0.25 },
  armor:      { apShare:0,      dpShare:0.1272, hpShare:0.40, dodgeShare:0.25 },
  gloves:     { apShare:0,      dpShare:0.0954, hpShare:0.15, dodgeShare:0.25 },
  boots:      { apShare:0,      dpShare:0.0954, hpShare:0.15, dodgeShare:0.25 },
  
  jackpot:    { apShare:0.10,   dpShare:0,      hpShare:0,    dodgeShare:0 },
};

function gearFloor(v) { return Math.max(1, Math.round(v)); }

const HP_GEAR_SCALE = 9;

const DODGE_GEAR_SCALE = 0.08;

// ==== src/progression/level-xp-data.js ====
const LEVEL_XP_TABLE = [
  1,1,1,1,1,161,472,1181,2626,5319,10005,17721,29865,48273,75300,113911,167777,241381,340127,
  470464,640005,857666,1133804,1480364,1911035,2441411,3089163,3874210,4818908,5948238,7290005,
  8875042,10737423,12914685,15448049,18382661,21767828,25657269,30109369,35187443,40960005,
  47501047,54890322,63213635,72563144,83037661,94742974,118571374,158997683,207619316,415238632,
  830477264,1245715896,1868573844,2802860766,8408582298,21021455745,52553639363,105107278725,
  210214557450,630643672350,1261287344700,2522574689400,5045149378800,10090298757600,
  20180597515200,40361195000000,80722390000000,161444780000000,322889560000000,645779120000000,
  1291558200000000,
];

// ==== src/world/region-tiers-data.js ====
const TIER_PREVIEW_CARD = {
  mid: { name:'Trésor de Heidel', icon:'🗺️', color:'#6ea3c9', key:'treasure_heidel' },
  end: { name:'Trésor de Calpheon', icon:'🗺️', color:'#e0935a', key:'treasure_calpheon' },
};
const ZONE_TIERS = [
  { id:'early', icon:'🟢', label:{fr:'Velia',en:'Velia'},       locked:false },
  { id:'mid',   icon:'🔵', label:{fr:'Heidel',en:'Heidel'},     locked:true },
  { id:'end',   icon:'🟡', label:{fr:'Calpheon',en:'Calpheon'}, locked:true },
  { id:'end2',  icon:'🟠', label:{fr:'Valencia',en:'Valencia'}, locked:true },
  { id:'end3',  icon:'🔴', label:{fr:'Edana',en:'Edana'},       locked:true },
];

// ==== src/combat/potions-data.js ====
const POTIONS = {
  small:    { name:{fr:'Petite potion de vie',  en:'Small HP Potion'},  icon:'🧪', cost:70,  heal:0.20, cd:2.4 },
  medium:   { name:{fr:'Potion de vie',         en:'HP Potion'},        icon:'🧴', cost:140, heal:0.35, cd:3.6 },
  large:    { name:{fr:'Grande potion de vie',  en:'Large HP Potion'},  icon:'⚗️', cost:240, heal:0.55, cd:5.0 },
  mega:     { name:{fr:'Potion de vie majeure', en:'Major HP Potion'},  icon:'🍾', cost:380, heal:0.80, cd:6.8 },
  infinite: { name:{fr:'Potion de vie infinie', en:'Infinite HP Potion'}, icon:'♾️', cost:0, heal:0.40, cd:4.2, locked:true },
};
const POTION_ORDER = ['small','medium','large','mega','infinite'];

// ==== src/classes/sorcier/skills-data.js ====
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
const MANA_REGEN_PER_SEC = 8; 
const MANA_POTION = { name:{fr:'Potion de mana',en:'Mana Potion'}, cost:110, restore:0.4, cd:4.5 };
const cds = {}; SKILLS.forEach(s => cds[s.id] = 0);
let buffTimer = 0, teleportCd = 0, evasionCd = 0;

// ==== src/core/game-core.js ====
'use strict';
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;
const $ = id => document.getElementById(id);

const $a = id => document.getElementById(id);

function uiTextScale() { return Math.min(3.2, Math.max(1, 1240 / (cv.clientWidth || 1240))); }

function isMobileViewport() { return window.innerWidth <= 1024; }

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ==================== I18N (déclaré tôt : utilisé dès les premiers rendus) ====================
let LANG = 'fr';
try { LANG = localStorage.getItem('velia-idle-lang') || 'fr'; } catch(e) {}
// traduction des noms dynamiques (zones, mobs, objets) — clé = texte FR d'origine
const NAME_EN = {
  // zones
  'Camp des Loups':'Wolf Camp', 'Ruines de Protty':'Protty Ruins', 'Repaire des Pirates':'Pirate Den',
  'Camp Rhutum':'Rhutum Camp', 'Ferme Shultz':'Shultz Farm', 'Colonie Sausan':'Sausan Colony',
  'Mine de Fer Abandonnée':'Abandoned Iron Mine', 'Poste Helm':'Helm Post',
  'Repaire Bandits Gahaz':'Gahaz Bandit Lair', 'Sanctuaire Elric':'Elric Shrine', 'Ruines de Kratuga':'Kratuga Ruins',
  'Planque des Mânes':'Manes\' Hideout',
  // 4e zone de chaque palier (2026-07-05, demande explicite) : complète la rotation avec la
  // boucle d'oreille manquante — reqAP/reqDP volontairement identiques à la dernière zone du
  // palier (voir le commentaire sur Planque des Mânes), aucun changement du plafond de stat
  'Ruines de Trent':'Trent Ruins', 'Île d\'Iliya':'Iliya Island', 'Base de Bashim':'Bashim Base', 'Forêt de Polly':'Polly Forest',
  // mobs
  'Loup':'Wolf', 'Esprit de Protty':'Protty Spirit', 'Pirate':'Pirate', 'Guerrier Rhutum':'Rhutum Warrior',
  'Garde Shultz':'Shultz Guard', 'Combattant Sausan':'Sausan Fighter', 'Mineur corrompu':'Corrupted Miner',
  'Soldat Helm':'Helm Soldier', 'Bandit Gahaz':'Gahaz Bandit', 'Sectateur d\'Elric':'Elric Cultist', 'Uluan':'Uluan',
  'Esprit des Mânes':'Manes Spirit',
  'Troll des Ruines':'Ruins Troll', 'Pirate d\'Iliya':'Iliya Pirate', 'Soldat de Bashim':'Bashim Soldier', 'Troll de Polly':'Polly Troll',
  // trash loot
  'Viande de loup':'Wolf Meat', "Lame rouillée d'Imp":"Rusty Imp Blade", 'Insigne de Sausan':'Sausan Badge',
  'Bourse de pirate':'Pirate Purse', 'Croc de Naga':'Naga Fang', 'Oreille de Fogan':'Fogan Ear',
  'Fer rouillé':'Rusted Iron', 'Fourrure de Biraghi':'Biraghi Fur', "Défense d'orc":'Orc Tusk',
  'Éclat de relique ancienne':'Ancient Relic Shard', "Relique d'Hystria":'Hystria Relic', 'Icône de Rhasia':'Rhasia Icon',
  'Larme de Mâne':'Manes\' Tear',
  'Pierre de Trent':'Trent Stone', 'Perle d\'Iliya':'Iliya Pearl', 'Insigne de Bashim':'Bashim Badge', 'Mousse de Polly':'Polly Moss',
  
  'revenu de base':'base income', 'optimisation':'enhancement', 'arme/armure (5 pièces)':'weapon/armor (5 pieces)',
  'craft endgame':'endgame crafting',
  
  'Pierre noire':'Black Stone', 'Éclat de cristal noir tranchant':'Sharp Black Crystal Shard',
  'Éclat de cristal noir dur':'Hard Black Crystal Shard', 'Poussière d\'esprit ancien':'Ancient Spirit Dust',
  'Pierre de Caphras':'Caphras Stone', 'Fragment de mémoire':'Memory Fragment', 'Marbre du Dieu déchu':'Fallen God\'s Marble',
  
  'Anneau Naru':'Naru Ring', 'Collier Naru':'Naru Necklace', 'Ceinture Naru':'Naru Belt',
  'Anneau Tuvala':'Tuvala Ring', 'Collier Tuvala':'Tuvala Necklace', 'Ceinture Tuvala':'Tuvala Belt',
  'Anneau Asula':'Asula Ring', 'Collier Asula':'Asula Necklace', 'Ceinture Asula':'Asula Belt',
  'Anneau de Cadry':'Cadry Ring', 'Collier du Dieu déchu':'Fallen God\'s Necklace',
  
  'Boucle Naru':'Naru Earring', 'Boucle Tuvala':'Tuvala Earring', 'Boucle Asula':'Asula Earring', "Tungrad's Earring":"Tungrad's Earring",
  
  'Grunil / Yuria':'Grunil / Yuria', 'Boss (Kzarka, Bheg, Urugon…)':'Boss (Kzarka, Bheg, Urugon…)',
  
  'ZONE DANGEREUSE':'DANGEROUS ZONE', 'ZONE DIFFICILE':'HARD ZONE', 'ZONE ADAPTÉE':'SUITABLE ZONE',
  'ZONE FACILE':'EASY ZONE', 'ZONE DÉPASSÉE':'TRIVIAL ZONE',
  'DANGEREUSE':'DANGEROUS', 'DIFFICILE':'HARD', 'ADAPTÉE':'SUITABLE', 'FACILE':'EASY', 'DÉPASSÉE':'TRIVIAL',
  
  'équilibré':'balanced', 'défensif':'defensive', 'overgeared':'overgeared',
};
function tr(s) { if (LANG !== 'en' || !s) return s; return NAME_EN[s] || s; }

let zoneIdx = 0;

let saveReady = false;
let atVelia = false; 
let autoOptTimer = null, autoOptTargetLvl = null; 
let lastLootEntry = null; 
const Z = () => ZONES[zoneIdx];

const S = {
  silver: 0, kills: 0, lootCount: 0, lvl: 1, xp: 0, xpNext: 1, 
  pa: 4, dp: 10,   
  castMult: 1, hpMax: 100, mpMax: 100, lootRadius: 26, 
  bossesKilled: {}, 
  penMastery: {}, 
  enhPeakByName: {}, 
  lootTableVersion: 'v2', 
  costPA: 60, costDP: 55, costCast: 90, costHP: 70, costLoot: 110,
  startTime: performance.now(), silverEarned: 0,
  
  silverEarnedAtLoad: 0, killsAtLoad: 0,
  
  tokenSilverEarned: 0, tokenSilverEarnedAtLoad: 0,
  bestKpm: 0, 
  
  bestSilverPerHour: 0,
  
  bestGearscore: 0, bestAp: 0, bestDp: 0,
  maxZoneIdx: 0, playtimeSec: 0, lootByItem: {},
  enhAttempts: 0, travelCount: 0, jackpotCount: 0, gearDropCount: 0, enhSuccess: 0,
  achUnlocked: {}, dq: null, wq: null, questTrackerOn: false,
  loyalty: 0, lastLoyaltyDate: null, mailbox: [],
  notifLog: [], 
  lastDeathAt: 0, 
  potionType: 'medium', 
  farmMode: 'loot', 
  
  aiCombatMode: 'équilibré',
  potionThreshold: 0.5, 
  useCronStone: false, 
};

function addSilver(delta, category, note) {
  if (!delta) return;
  S.silver += delta;
  if (delta > 0) S.silverEarned += delta;
  
  if (delta > 0 && category === 'loot') S.tokenSilverEarned = (S.tokenSilverEarned||0) + delta;
  if (typeof queueSilverLedger === 'function') queueSilverLedger(delta, category, note);
}

function trackLoot(name) { S.lootByItem[name] = (S.lootByItem[name]||0) + 1; }
function bestFarmedItem() {
  let best = null, bestN = 0;
  for (const name in S.lootByItem) if (S.lootByItem[name] > bestN) { best = name; bestN = S.lootByItem[name]; }
  return best ? { name: best, count: bestN } : null;
}

const INV_SIZE = 192;
const INV = new Array(INV_SIZE).fill(null);   
const MAX_STACK = 9999;

const COMPENDIUM_BAG = new Array(INV_SIZE).fill(null);
function compendiumBagHasName(name) { return COMPENDIUM_BAG.some(s => s && s.name === name); }

const VELIA_CHEST = new Array(INV_SIZE).fill(null);
const VELIA_CHEST_OPEN = 20;
function compendiumBagAdd(obj) {
  const idx = COMPENDIUM_BAG.findIndex(s => s === null);
  if (idx === -1) return false;
  COMPENDIUM_BAG[idx] = { ...obj };
  return true;
}

function ensureCompendiumProtection(name) {
  if (!name || S.penMastery[name]) return;
  const curIdx = COMPENDIUM_BAG.findIndex(s => s && s.name === name);
  const current = curIdx !== -1 ? COMPENDIUM_BAG[curIdx] : null;
  let bestIdx = -1, bestEnh = current ? (current.enhLv || 0) : -1;
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i];
    if (!it || it.name !== name || (it.kind !== 'gear' && it.kind !== 'jackpot')) continue;
    const enh = it.enhLv || 0;
    if (enh > bestEnh) { bestEnh = enh; bestIdx = i; }
  }
  if (bestIdx === -1) return; 
  const better = INV[bestIdx];
  if (current) {
    if (!invAdd(current)) return; 
    COMPENDIUM_BAG[curIdx] = { ...better };
    INV[bestIdx] = null;
  } else if (compendiumBagAdd(better)) {
    INV[bestIdx] = null;
  }
}

const EQUIP = {
  weapon: null, awakening: null, secondary: null, book: null,
  helmet: null, armor: null, gloves: null, boots: null,
  ring1: null, ring2: null, necklace: null, earring1: null, earring2: null, belt: null,
  
  artifact1: null, artifact2: null, eqStone: null,
};
const ARMOR_SLOTS = ['helmet','armor','gloves','boots'];
const ACC_SLOTS = ['ring1','ring2','necklace','earring1','earring2','belt','artifact1','artifact2','eqStone'];
const WEAPON_SLOTS = ['weapon','awakening','secondary'];

const OPTIMIZABLE_SLOTS = [...WEAPON_SLOTS, ...ARMOR_SLOTS, ...ACC_SLOTS];

function invWeight() {
  let w = 0;
  for (const s of INV) if (s) w += (s.weight||0.1) * s.qty;
  return w;
}

const MAX_WEIGHT = () => 800;
function invUsed() { return INV.filter(s => s).length; }

function invAdd(obj) {
  if (obj.stackable) {
    const slot = INV.find(s => s && s.key === obj.key && s.qty < MAX_STACK);
    if (slot) { slot.qty += obj.qty; enforceTreasureStackCap(slot); return true; }
  }
  const idx = INV.findIndex(s => s === null);
  if (idx === -1) return false; 
  
  INV[idx] = { pickedAt: Date.now(), ...obj };
  enforceTreasureStackCap(INV[idx]);
  return true;
}
function invRemoveAt(i, n) {
  const s = INV[i]; if (!s) return;
  s.qty -= n;
  if (s.qty <= 0) INV[i] = null;
}

const ENH_NAMES = ['+0','+1','+2','+3','+4','+5','+6','+7','+8','+9','+10','+11','+12','+13','+14','+15',
  'PRI (I)','DUO (II)','TRI (III)','TET (IV)','PEN (V)'];
const PRI_IDX = 16; 
const SAFE_IDX = 8; 

const ENH_STEP = [0, .05,.05,.05,.05,.05,.05,.05,  .03,.03,.03,.03,.03,.03,.03,.03,  .20,.10,.13,.18,.25];
function enhBonus(lvl) { let b = 0; for (let i = 1; i <= (lvl||0); i++) b += ENH_STEP[i]; return b; }
function itemMult(item) { return item && item.optimizable ? (1 + enhBonus(item.enhLv||0)) : 1; }

function effectiveApDp(item) {
  const mult = itemMult(item);
  return { ap: Math.floor((item.ap||0) * mult), dp: Math.floor((item.dp||0) * mult), hp: Math.floor((item.hp||0) * mult),
    dodge: Math.round((item.dodge||0) * mult * 100) / 100 };
}

function projectedApDp(item, targetLvl) {
  const mult = 1 + enhBonus(targetLvl);
  return { ap: Math.floor((item.ap||0) * mult), dp: Math.floor((item.dp||0) * mult), hp: Math.floor((item.hp||0) * mult),
    dodge: Math.round((item.dodge||0) * mult * 100) / 100 };
}

const ENH_CHANCE_FLAT = {
  8:.45,  9:.38,  10:.30, 11:.24, 12:.18, 13:.13, 14:.08, 15:.05,   
  16:.12, 17:.09, 18:.06, 19:.03, 20:.012,                          
};

const ENH_FS_INC = {
  8:.05,  9:.045, 10:.04, 11:.035, 12:.03, 13:.025, 14:.02, 15:.015,
  16:.015,17:.012,18:.008,19:.004, 20:.0015,
};
function itemFailstack(item, level) { return (item && item.fsByLevel && item.fsByLevel[level]) || 0; }
function addItemFailstack(item, level) {
  if (!item) return;
  if (!item.fsByLevel) item.fsByLevel = {};
  item.fsByLevel[level] = (item.fsByLevel[level] || 0) + 1;
}

function enhChanceParts(level, item) {
  if (level < SAFE_IDX) return { base:1, bonus:0, total:1 };
  const base = ENH_CHANCE_FLAT[level] ?? .01;
  const inc = ENH_FS_INC[level] ?? .01;
  const fs = itemFailstack(item, level);
  const bonus = Math.min(0.9 - base, fs * inc); 
  return { base, bonus: Math.max(0, bonus), total: base + Math.max(0, bonus) };
}
function enhChance(level, item) { return enhChanceParts(level, item).total; }

function weaponAP() {
  let a = 0;
  for (const k of WEAPON_SLOTS) { const e = EQUIP[k]; if (e) a += (e.ap||0) * itemMult(e); }
  return a;
}

function equipAP() {
  let a = 0;
  for (const k of [...ARMOR_SLOTS, ...ACC_SLOTS]) { const e = EQUIP[k]; if (e) a += (e.ap||0) * itemMult(e); }
  return a;
}
function equipDP() {
  let d = 0;
  for (const k of [...ARMOR_SLOTS, ...ACC_SLOTS]) { const e = EQUIP[k]; if (e) d += (e.dp||0) * itemMult(e); }
  return d;
}

function equipHP() {
  let h = 0;
  for (const k of ARMOR_SLOTS) { const e = EQUIP[k]; if (e) h += (e.hp||0) * itemMult(e); }
  return h;
}
const effHpMax = () => S.hpMax + equipHP();

const effManaMax = () => S.mpMax;

function equipDodge() {
  let d = 0;
  for (const k of ARMOR_SLOTS) { const e = EQUIP[k]; if (e) d += (e.dodge||0) * itemMult(e); }
  return d;
}
function armorBonusAvg() {
  const pieces = ARMOR_SLOTS.map(k => EQUIP[k]).filter(Boolean);
  if (!pieces.length) return 0;
  return pieces.reduce((s,e) => s + enhBonus(e.enhLv||0), 0) / pieces.length;
}
const apEff = () => (S.pa + weaponAP() + equipAP());
const totalDP = () => S.dp + equipDP();
const GS = () => (apEff() + totalDP()) / 2; 
const apRatio = (z) => apEff() / (z || Z()).reqAP;
const dpRatio = (z) => totalDP() / (z || Z()).reqDP;
const bottleneck = (z) => Math.min(apRatio(z), dpRatio(z));

function zoneItemNames(zi) {
  const z = ZONES[zi], tier = gearTierForZone(zi);
  return [tr(z.loot.trash.name), tr(tier.material.name), tr(z.loot.jackpot.name), tr(z.loot.craft.name)];
}
function zoneFullyCollected(zi) { return zoneItemNames(zi).every(n => compendiumItemDone(n)); }

function checkZoneCompendiumUnlock(zi, wasDone) {
  if (wasDone || !zoneFullyCollected(zi)) return;
  floatTxt(P.x, P.y, 96, '📖 Compendium — '+tr(ZONES[zi].name), { gold:true });
  const zc = compendiumZoneCount();
  logToDiscord('📖 Compendium', `**${myPseudo||'Joueur'}** débloque le bonus de **${tr(ZONES[zi].name)}** (${zc}/${ZONES.length} zones${zc>=ZONES.length?' — COMPENDIUM COMPLET ✓':''})`, 0xc9a55a);
}

function markBossDefeated(bossId) {
  if (S.bossesKilled[bossId]) return;
  S.bossesKilled[bossId] = true;
  const b = BOSS_ROSTER[bossId];
  floatTxt(P.x, P.y, 96, '📖 Compendium — '+b.name[LANG], { gold:true });
  logToDiscord('📖 Compendium', `**${myPseudo||'Joueur'}** débloque le bonus de **${b.name.fr}** (World Boss)`, 0xc9a55a);
}
function compendiumZoneCount() { return ZONES.reduce((n,z,zi) => n + (zoneFullyCollected(zi)?1:0), 0); }
function compendiumBossCount() { return Object.keys(S.bossesKilled||{}).length; }
function compendiumTotalCount() { return compendiumZoneCount() + compendiumBossCount(); }
function compendiumTotalMax() { return ZONES.length + Object.keys(BOSS_ROSTER).length; }
function compendiumPct() { return compendiumTotalCount() * 1; } 

function penMasteryItemList() {
  const names = [];
  for (const tier of GEAR_TIERS) for (const slot of GEAR_SLOTS) names.push(tier.sets[slot]);
  for (const z of ZONES) names.push(z.loot.jackpot.name);
  return names; 
}
function markPenMastery(name) {
  if (S.penMastery[name]) return;
  S.penMastery[name] = true;
  const done = compendiumPenCount(), max = penMasteryItemList().length;
  floatTxt(P.x, P.y, 96, '🌟 PEN — '+tr(name), { gold:true });
  logToDiscord('🌟 Maîtrise PEN', `**${myPseudo||'Joueur'}** amène ${name} à PEN pour la première fois (${done}/${max}${done>=max?' — MAÎTRISE COMPLÈTE ✓':''})`, 0xffe9a8);
}
function compendiumPenCount() { return Object.keys(S.penMastery||{}).length; }

function evictMasteredFromCompendiumBag(name) {
  if (!name || !S.penMastery[name]) return;
  const idx = COMPENDIUM_BAG.findIndex(s => s && s.name === name);
  if (idx === -1) return;
  if (invAdd({ ...COMPENDIUM_BAG[idx] })) COMPENDIUM_BAG[idx] = null;
  
}

function trackEnhPeak(name, lvl) {
  if (!S.enhPeakByName) S.enhPeakByName = {};
  if ((S.enhPeakByName[name]||0) < lvl) S.enhPeakByName[name] = lvl;
}

function levelSpdPct() { return Math.max(0, Math.min(S.lvl,61)-1) / 60 * 75; }
function totalSpdPct() { return levelSpdPct() + compendiumPct(); }

function levelSpdPctFor(lvl) { return Math.max(0, Math.min(lvl,61)-1) / 60 * 75; }
function hpMaxFor(lvl) { return 100 + 8*Math.max(0, lvl-1); }
function totalDmgPct() { return compendiumPct(); } 

function dodgeEffectiveness(dpR) {
  if (dpR >= 1) return 1;
  return Math.max(0, (dpR - 0.5) / 0.5);
}
function totalDodgePct(dpR) {
  const raw = equipDodge() + compendiumPct();
  return Math.min(60, raw * dodgeEffectiveness(dpR ?? dpRatio())); 
}

function isoX(x, y) { return (x - y); }
function isoY(x, y) { return (x + y) * .5; }
const cam = { x: 0, y: 0 };
function toScreen(x, y, z = 0) {
  return {
    sx: W/2 + isoX(x,y) - isoX(cam.x,cam.y),
    sy: H/2 + 30 + isoY(x,y) - isoY(cam.x,cam.y) - z,
  };
}

function screenToWorld(sx, sy) {
  const a = sx - W/2 + isoX(cam.x,cam.y);
  const b = 2*(sy - H/2 - 30) + isoY(cam.x,cam.y)*2;
  return { x: (a+b)/2, y: (b-a)/2 };
}

const P = {
  x: 0, y: 0, hp: 100, mp: 100, 
  state: 'search', stateT: 0,
  castTimer: 0, castingSkill: null, castProgress: 0,
  bob: 0, faceX: 1, orbitDir: 1, orbitAng: 0,
  potCd: 0, manaPotCd: 0, faint: 0, tpFlash: 0, lootTarget: null, lootClusterX: 0, lootClusterY: 0,
  manualTarget: null, manualMoveT: 0,
  dmgBurstAccum: 0, dmgBurstT: 0, 
  faintZoneIdx: 0, faintAtVelia: false, 
};
const BASE_SPEED = 92;

let packs = [], drops = [], particles = [], floats = [], corpses = [];
let packSerial = 0, target = null, shakeT = 0, shakeAmp = 0;

function dist(ax,ay,bx,by){ return Math.hypot(ax-bx,ay-by); }

function spawnPackNear() {
  packSerial++;
  const z = Z();
  
  const alpha = zoneIdx === 6 ? packSerial % 2 === 0 : packSerial % 5 === 0;
  let x, y, tries = 0;
  do {
    const a = Math.random()*Math.PI*2, d = 320 + Math.random()*360;
    x = P.x + Math.cos(a)*d; y = P.y + Math.sin(a)*d; tries++;
  } while (tries < 12 && packs.some(p => !p.dead && dist(x,y,p.x,p.y) < 200));

  const baseSize = 2 + Math.floor(zoneIdx * 0.5); 
  const n = alpha ? 2 : Math.min(9, baseSize + Math.floor(Math.random()*3));
  const hpPer = z.hpPer * (alpha ? 2.6 : 1);
  const wolves = [];
  for (let i = 0; i < n; i++) {
    const a = (i/n)*Math.PI*2 + Math.random();
    wolves.push({
      ox: Math.cos(a)*(30+Math.random()*22), oy: Math.sin(a)*(30+Math.random()*22),
      gx: Math.cos(a)*10, gy: Math.sin(a)*10,
      scale: alpha ? 1.5 : .85 + Math.random()*.25,
      phase: Math.random()*6.28,
      tone: alpha ? z.alphaTone : z.tones[i % z.tones.length],
      alpha, 
      atkT: 1 + Math.random()*2, lunge: 0,
      
      hp: hpPer, maxHp: hpPer, dead: false,
    });
  }
  packs.push({
    x, y, wolves, alpha,
    aggro:false, gathered:0, dead:false,
    dmg: z.dmg * (alpha ? 1.8 : 1),
  });
}

function targetPackCount() {
  if (atVelia) return 0;
  
  if (zoneIdx===0 || zoneIdx===1 || zoneIdx===2 || zoneIdx===12) return 6;  
  if (zoneIdx===3 || zoneIdx===4 || zoneIdx===5 || zoneIdx===13) return 8;  
  
  if (zoneIdx===6 || zoneIdx===7 || zoneIdx===8 || zoneIdx===14) return 16; 
  
  return 28; 
}

function resetWorld(keepPos) {
  packs = []; drops = []; corpses = []; particles = []; floats = [];
  target = null; P.lootTarget = null; P.manualTarget = null;
  if (!keepPos) { P.x = 0; P.y = 0; }
  cam.x = P.x; cam.y = P.y; P.lootClusterX = 0; P.lootClusterY = 0;
  P.state = 'search'; P.hp = effHpMax();
  lastLootEntry = null; 
  if (atVelia) return; 
  for (let i = 0; i < targetPackCount(); i++) spawnPackNear();
}
resetWorld();

let DEFAULT_SAVE = JSON.parse(JSON.stringify(getSaveState()));

function hpTier() {
  const p = P.hp / effHpMax();
  if (p > .8) return 'agressif';
  if (p > .5) return 'normal';
  if (p > .25) return 'prudent';
  return 'urgence';
}
function setState(st){ P.state = st; P.stateT = 0; }

function speedMult() {
  const dangerMult = isZoneDangerous() ? DANGER_PLAYER_SPEED_MULT : 1;
  return (1 + totalSpdPct()/100) * dangerMult;
}
function moveToward(tx, ty, speed, dt) {
  const d = dist(P.x,P.y,tx,ty);
  if (d < 1) return d;
  const vx = (tx-P.x)/d, vy = (ty-P.y)/d;
  const effSpeed = speed * speedMult();
  P.x += vx*effSpeed*dt; P.y += vy*effSpeed*dt;
  P.faceX = isoX(vx,vy) >= 0 ? 1 : -1;
  P.bob += dt*9;
  return d;
}
function doTeleport(dirX, dirY) {
  teleportCd = 4.5;
  const d = Math.hypot(dirX,dirY)||1;
  const nx = P.x + dirX/d*95, ny = P.y + dirY/d*95;
  particles.push({ type:'tpTrail', x1:P.x, y1:P.y, x2:nx, y2:ny, life:.4, max:.4 });
  P.x = nx; P.y = ny; P.tpFlash = 1;
}

function fsm(dt) {
  P.stateT += dt;
  if (P.faint > 0) {
    P.faint -= dt;
    if (P.faint <= 0) { die(); }
    return;
  }

  P.potCd = Math.max(0, P.potCd-dt);
  const tier = hpTier();
  
  if (!atVelia && (P.hp/effHpMax()) <= (S.potionThreshold ?? 0.5) && P.potCd <= 0) usePotion();
  
  P.mp = Math.min(effManaMax(), P.mp + MANA_REGEN_PER_SEC*dt);
  P.manaPotCd = Math.max(0, P.manaPotCd-dt);
  if (!atVelia && (P.mp/effManaMax()) <= 0.3 && P.manaPotCd <= 0) usePotionMana();
  if (tier==='urgence' && teleportCd <= 0 && target && !target.dead) {
    doTeleport(P.x-target.x, P.y-target.y);
    teleportCd = 0; doTeleport(P.x-target.x, P.y-target.y);
  }

  if (P.manualTarget) {
    const d = moveToward(P.manualTarget.x, P.manualTarget.y, BASE_SPEED*(buffTimer>0?1.25:1), dt);
    if (d < 14) P.manualTarget = null;
    for (const k in cds) cds[k] = Math.max(0, cds[k]-dt);
    buffTimer = Math.max(0,buffTimer-dt);
    teleportCd = Math.max(0,teleportCd-dt);
    evasionCd = Math.max(0,evasionCd-dt);
    P.tpFlash = Math.max(0,P.tpFlash-dt*3);
    return;
  }

  switch (P.state) {
    case 'search': {
      target = packs.filter(p=>!p.dead)
                    .sort((a,b)=>dist(P.x,P.y,a.x,a.y)-dist(P.x,P.y,b.x,b.y))[0]||null;
      if (target) setState('move');
      break;
    }
    case 'move': {
      if (!target || target.dead) { setState('search'); break; }
      const d = moveToward(target.x,target.y,BASE_SPEED*(buffTimer>0?1.25:1),dt);
      if (teleportCd <= 0 && d > 260) doTeleport(target.x-P.x,target.y-P.y);
      if (d <= 170) { target.aggro = true; setState(aiMode()==='overgeared'?'combat':'gather'); }
      break;
    }
    case 'gather': {
      if (!target || target.dead) { setState('search'); break; }
      target.gathered = Math.min(1, target.gathered + dt/1.1);
      P.orbitAng += dt*2.2*P.orbitDir;
      moveToward(target.x+Math.cos(P.orbitAng)*105, target.y+Math.sin(P.orbitAng)*105, BASE_SPEED*.85, dt);
      if (target.gathered >= 1) setState('combat');
      break;
    }
    case 'combat': {
      if (!target || target.dead) { setState(S.farmMode==='xp'?'search':'loot'); break; }
      combatTick(dt);
      break;
    }
    case 'kite': {
      if (!target || target.dead) { setState(S.farmMode==='xp'?'search':'loot'); break; }
      P.orbitAng += dt*1.9*P.orbitDir;
      const r = 125 + Math.sin(P.stateT*3)*14;
      moveToward(target.x+Math.cos(P.orbitAng)*r, target.y+Math.sin(P.orbitAng)*r, BASE_SPEED*.95, dt);
      const danger = target.wolves.filter(w=>!w.dead && w.lunge>0).length >= 2;
      if (danger && teleportCd <= 0) { doTeleport(P.x-target.x,P.y-target.y); P.orbitDir *= -1; }
      if (pickSkill()) setState('combat');
      if (P.stateT > 2.5) setState('combat');
      break;
    }
    case 'loot': {
      P.bob += dt*7;
      
      if (!P.lootTarget || P.lootTarget.taken) {
        P.lootStuckT = 0;
        P.lootTarget = drops.filter(l=>!l.taken && !l.skipped && dist(P.lootClusterX,P.lootClusterY,l.x,l.y)<320)
                            .sort((a,b)=>dist(P.x,P.y,a.x,a.y)-dist(P.x,P.y,b.x,b.y))[0]||null;
      }
      if (P.lootTarget) {
        moveToward(P.lootTarget.x,P.lootTarget.y,BASE_SPEED*.9,dt);
        
        P.lootStuckT = (P.lootStuckT||0) + dt;
        if (P.lootStuckT > 1.5) { P.lootTarget.skipped = true; P.lootTarget = null; P.lootStuckT = 0; setState('search'); }
      }
      else setState('search');
      break;
    }
  }

  for (const k in cds) cds[k] = Math.max(0, cds[k]-dt);
  buffTimer = Math.max(0,buffTimer-dt);
  teleportCd = Math.max(0,teleportCd-dt);
  evasionCd = Math.max(0,evasionCd-dt);
  P.tpFlash = Math.max(0,P.tpFlash-dt*3);
}

function pickSkill() {
  const buff = SKILLS.find(s=>s.type==='buff');
  if (buffTimer <= 0 && cds[buff.id] <= 0 && P.mp >= buff.mp) return buff;
  
  const ready = SKILLS.filter(s=>!s.type && cds[s.id]<=0 && P.mp >= s.mp).sort((a,b)=>a.prio-b.prio);
  if (!ready.length) return null;
  const best = ready[0];
  if (best.prio >= 8) {
    const soonBig = SKILLS.filter(s=>!s.type && s.prio<=5).some(s=>cds[s.id]>0 && cds[s.id]<.6);
    if (soonBig) return null;
  }
  return best;
}

function combatTick(dt) {
  const mode = aiMode(), tier = hpTier();
  const wantDist = tier==='agressif' ? 75 : tier==='normal' ? 100 : 130;
  const d = dist(P.x,P.y,target.x,target.y);
  const dx = (P.x-target.x)/(d||1), dy = (P.y-target.y)/(d||1);
  const radial = wantDist - d;
  P.x += dx*radial*dt*2.2; P.y += dy*radial*dt*2.2;
  P.orbitAng = Math.atan2(P.y-target.y,P.x-target.x) + dt*.9*P.orbitDir;
  const nx = target.x + Math.cos(P.orbitAng)*Math.max(d,40);
  const ny = target.y + Math.sin(P.orbitAng)*Math.max(d,40);
  P.x += (nx-P.x)*dt*3; P.y += (ny-P.y)*dt*3;
  P.faceX = isoX(target.x-P.x,target.y-P.y) >= 0 ? 1 : -1;
  P.bob += dt*4;
  if (Math.random() < dt*.15) P.orbitDir *= -1;

  const incoming = !isZoneDangerous() && target.wolves.some(w=>!w.dead && w.lunge>.25 && w.lunge<.5);
  if (incoming && evasionCd <= 0 && mode !== 'overgeared') {
    evasionCd = 3.2;
    P.x += dx*36; P.y += dy*36; P.tpFlash = .6;
    floatTxt(P.x,P.y,92,'Évasion',{blue:true});
  }

  if (P.castTimer > 0) {
    P.castTimer -= dt;
    P.castProgress = 1 - P.castTimer/(P.castingSkill.castT/S.castMult);
    if (P.castTimer <= 0) resolveSkill(P.castingSkill);
    return;
  }
  const sk = pickSkill();
  if (sk) {
    P.castingSkill = sk;
    P.castTimer = sk.castT/S.castMult;
    P.mp = Math.max(0, P.mp - sk.mp); 
    cds[sk.id] = sk.cd * (mode==='overgeared'?.85:1);
    $('aiSkill').textContent = sk.name;
    
    spawnCastOriginVfx(sk);
  } else if (tier !== 'agressif' || mode === 'défensif') setState('kite');
}

function currentWolf(p) { return p.wolves.find(w => !w.dead) || null; }

function resolveSkill(sk) {
  P.castingSkill = null;
  if (sk.type === 'buff') { buffTimer = sk.dur; floatTxt(P.x,P.y,98,'✦ Speed Spell',{gold:true}); return; }
  if (!target || target.dead) return;
  const aliveWolves = target.wolves.filter(w => !w.dead);
  if (!aliveWolves.length) return; 
  spawnVfx(sk,target);
  if (sk.shake) { shakeT=.3; shakeAmp=sk.shake; }
  
  const touchingPacks = packs.filter(p => !p.dead && (p === target || dist(p.x,p.y,target.x,target.y) < 200));
  const allHits = [];
  for (const p of touchingPacks) for (const w of p.wolves) if (!w.dead) allHits.push({ p, w });
  
  const splitFactor = touchingPacks.length > 1 ? aliveWolves.length / allHits.length : 1;
  for (const { p, w } of allHits) {
    const crit = Math.random() < .15;
    
    const dmg = apEff() * sk.dmg * dmgMult(apRatio()) * (1+totalDmgPct()/100)
              * (0.9+Math.random()*.25) * (crit?2:1) * (buffTimer>0?1.12:1) * splitFactor;
    w.hp -= dmg;
    const wp = wolfPos(p,w);
    floatTxt(wp.x+(Math.random()*36-18), wp.y+(Math.random()*36-18), 62,
      '-'+fmt(Math.ceil(dmg))+(crit?'!':''), {crit});
    if (w.hp <= 0 && !w.dead) killWolf(p, w);
  }
}

function wolfPos(p,w){
  return { x:p.x + w.ox*(1-p.gathered) + w.gx*p.gathered,
           y:p.y + w.oy*(1-p.gathered) + w.gy*p.gathered };
}
function wolvesTick(dt) {
  
  if (P.faint > 0) return;
  
  const dpR = dpRatio();
  const mitig = dmgTakenMult(dpR);
  const dangerous = isZoneDangerous();
  
  const dodgeChance = dangerous ? 0 : totalDodgePct(dpR) / 100; 
  const mobSpeed = 50 * (dangerous ? DANGER_MOB_SPEED_MULT : 1);
  
  for (const p of packs) {
    if (!p.dead && !p.aggro && dist(P.x,P.y,p.x,p.y) <= 400) p.aggro = true;
  }
  for (const p of packs) {
    if (p.dead || !p.aggro) continue;
    const d = dist(P.x,P.y,p.x,p.y);
    
    if (d > 550) { p.aggro = false; continue; }
    if (d > 60) { p.x += (P.x-p.x)/d*mobSpeed*dt; p.y += (P.y-p.y)/d*mobSpeed*dt; }
    for (const w of p.wolves) {
      if (w.dead) continue; 
      if (w.lunge > 0) {
        w.lunge -= dt;
        if (w.lunge <= 0) {
          const wp = wolfPos(p,w);
          if (dist(P.x,P.y,wp.x,wp.y) < 95) {
            if (Math.random() < dodgeChance) {
              floatTxt(P.x,P.y,80,LANG==='fr'?'Esquivé !':'Dodged!',{blue:true});
            } else {
              const dmgRaw = p.dmg*(0.8+Math.random()*.4)*mitig;
              let dmg;
              if (dangerous) {
                
                dmg = Math.max(dmgRaw, effHpMax());
              } else {
                
                if (performance.now() - P.dmgBurstT > 1000) P.dmgBurstAccum = 0;
                P.dmgBurstT = performance.now();
                const room = Math.max(0, effHpMax()*0.3 - P.dmgBurstAccum);
                dmg = Math.min(dmgRaw, room);
                P.dmgBurstAccum += dmg;
              }
              P.hp -= dmg;
              floatTxt(P.x,P.y,80,'-'+Math.ceil(dmg),{hurt:true});
              if (P.hp <= 0) {
                P.hp = 0; P.faint = 6;
                
                P.faintZoneIdx = zoneIdx; P.faintAtVelia = atVelia;
                floatTxt(P.x,P.y,105,'K.O.',{hurt:true});
                S.xp = Math.max(0, S.xp - S.xpNext*.01); 
              }
            }
          }
        }
      } else {
        w.atkT -= dt;
        if (w.atkT <= 0) {
          
          w.atkT = dangerous ? 0.4+Math.random()*.3 : 2.6+Math.random()*2;
          w.lunge = dangerous ? 0.15 : 0.55;
        }
      }
    }
  }
}

function killWolf(p, w) {
  w.dead = true;
  const z = Z(), lm = lootMult(bottleneck());
  const killsBefore = S.kills;
  S.kills++;
  
  if (Math.floor(S.kills/1000) > Math.floor(killsBefore/1000)) {
    logToDiscord('💀 Palier de kills', `**${myPseudo||'Joueur'}** vient d'atteindre **${fmt(Math.floor(S.kills/1000)*1000)}** monstres tués à vie`, 0x7a2d33);
  }
  gainXp(z.xp * (p.alpha?3:1));
  const wp = wolfPos(p,w);
  corpses.push({ x:wp.x, y:wp.y, scale:w.scale, tone:w.tone, life:2.4 });
  rollDrops(wp, p.alpha, lm);
  hud();
  if (p.wolves.every(ww => ww.dead)) killPack(p);
}
function killPack(p) {
  p.dead = true;
  $('aiSkill').textContent = '—';
  P.lootTarget = null;
  if (S.farmMode === 'xp') {
    setState('search'); 
  } else {
    P.lootClusterX = p.x; P.lootClusterY = p.y; 
    setState('loot');
  }
  hud();
}

function fmt(n){ n=Math.floor(n); return n>=1e6 ? (n/1e6).toFixed(1)+'M' : n>=1e3 ? (n/1e3).toFixed(1)+'k' : n; }
const STATE_FR = { search:'SearchPack', move:'MoveToPack', gather:'GatherPack', combat:'Combat', kite:'Kite', loot:'Loot' };

const skillBar = $('skillBar');
const skEls = {};
for (const s of SKILLS) {
  const el = document.createElement('div');
  el.className = 'sk';
  el.innerHTML = `<div class="ic">${s.ic}</div><div class="nm">${s.name.split(' ')[0]}</div><div class="cd"></div>`;
  el.title = s.name;
  skillBar.appendChild(el);
  skEls[s.id] = el;
}

let lootPreviewIdx = null; 

let zoneTier = 'early';

let statsTab = 'perso';
function renderStatsTabs() {
  const el = $('statsTabTabs'); if (!el) return;
  el.querySelectorAll('.catTab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === statsTab));
  const personaPane = $('statsPersoPane'), recoPane = $('statsRecoPane'), levelsPane = $('statsLevelsPane');
  if (personaPane) personaPane.style.display = statsTab === 'perso' ? '' : 'none';
  if (recoPane) recoPane.style.display = statsTab === 'reco' ? '' : 'none';
  if (levelsPane) levelsPane.style.display = statsTab === 'levels' ? '' : 'none';
  if (statsTab === 'reco' && recoPane && !recoPane.dataset.rendered) { renderStatsRecoPane(); recoPane.dataset.rendered = '1'; }
  
  if (statsTab === 'levels') renderStatsLevelsPane();
}
(function wireStatsTabTabs() {
  const el = $('statsTabTabs'); if (!el) return;
  el.querySelectorAll('.catTab').forEach(btn => {
    btn.onclick = () => { statsTab = btn.dataset.tab; renderStatsTabs(); };
  });
})();

function renderStatsRecoPane() {
  const el = $('statsRecoPane'); if (!el) return;
  const rows = [
    { label: LANG==='fr'?'💰 Meilleur silver/h':'💰 Best silver/h', best: bestZoneForMetric(zoneSilverPerHour), fmtV: v => fmt(Math.round(v))+'/h' },
    { label: LANG==='fr'?'⭐ Meilleur XP/h':'⭐ Best XP/h', best: bestZoneForMetric(zoneXpPerHour), fmtV: v => fmt(Math.round(v))+'/h' },
    { label: LANG==='fr'?'⚔️ Meilleurs kills/min':'⚔️ Best kills/min', best: bestZoneForMetric(zoneKillsPerMin), fmtV: v => v.toFixed(1)+'/min' },
  ];
  el.innerHTML = `<div class="constructionBanner">${LANG==='fr'
      ? '🚧 En construction — calculs et présentation encore amenés à changer'
      : '🚧 Under construction — calculations and presentation still subject to change'}</div>` +
    `<div class="admHint">${LANG==='fr'
      ? 'Classement théorique (stuff idéal, indépendant de ta survie actuelle) — clique une zone pour t\'y rendre.'
      : 'Theoretical ranking (ideal gear, independent of your current survival) — click a zone to go there.'}</div>` +
    rows.map((r,ri) => `<div class="row statsRecoRow" data-zi="${r.best.i}" data-ri="${ri}">` +
      `<span>${r.label}</span><span class="v">${tr(ZONES[r.best.i].name)} · ${r.fmtV(r.best.v)}</span></div>`).join('');
  el.querySelectorAll('.statsRecoRow').forEach(row => {
    row.onclick = () => { const zi = parseInt(row.dataset.zi,10); if (atVelia || zi !== zoneIdx) travelTo(zi); };
  });
}

function renderStatsLevelsPane() {
  const el = $('statsLevelsPane'); if (!el) return;
  const cur = S.lvl, maxLvl = LEVEL_XP_TABLE.length - 1;
  const from = Math.max(1, cur - 5), to = Math.min(maxLvl, cur + 5);
  let rows = '';
  for (let lvl = from; lvl <= to; lvl++) {
    const isCur = lvl === cur;
    rows += `<div class="row statsLevelRow${isCur?' current':''}">` +
      `<span>${LANG==='fr'?'Niv.':'Lvl'} ${lvl}${isCur?(LANG==='fr'?' — toi':' — you'):''}</span>` +
      `<span class="v">${LANG==='fr'?'PV':'HP'} ${fmt(hpMaxFor(lvl))} · SPD +${Math.round(levelSpdPctFor(lvl))}% · XP ${fmt(xpNeededFor(lvl))}</span></div>`;
  }
  el.innerHTML = `<div class="admHint">${LANG==='fr'
    ? '5 niveaux avant et après le tien — PV de base (hors équipement), bonus de Vitesse et XP requise pour CE niveau.'
    : '5 levels before and after yours — base HP (gear excluded), Speed bonus, and XP required for THAT level.'}</div>` + rows;
}

function renderZoneTierTabs() {
  const el = $('zoneTierTabs'); if (!el) return;
  
  el.innerHTML = ZONE_TIERS.map(t => {
    const card = TIER_PREVIEW_CARD[t.id];
    const lockedTitle = card
      ? (LANG==='fr' ? `Bientôt disponible — droppera : ${card.icon} ${tr(card.name)}` : `Coming soon — will drop: ${card.icon} ${tr(card.name)}`)
      : (LANG==='fr' ? 'Bientôt disponible' : 'Coming soon');
    return `<button class="catTab${t.id===zoneTier?' active':''}${t.locked?' locked':''}"` +
    `${t.locked?' disabled title="'+lockedTitle+'"':''} data-tier="${t.id}">` +
    `${t.locked?'<span class="zoneTierLock">🔒</span>':''}<span class="zoneTierLabel">${t.icon} ${t.label[LANG]}</span></button>`;
  }).join('');
  el.querySelectorAll('.catTab:not(.locked)').forEach(btn => {
    btn.onclick = () => { zoneTier = btn.dataset.tier; buildZoneList(); };
  });
}

let zonePlayerCounts = {};
let adminZoneIdx = null;
let veliaPlayers = [];

let readPatches = new Set();
try { readPatches = new Set(JSON.parse(localStorage.getItem('velia-patch-read') || '[]')); } catch(e) {}
let seenThisSession = new Set();
function buildZoneList() {
  renderZoneTierTabs();
  const list = $('zoneList');
  list.innerHTML = '';
  
  const veliaRow = document.createElement('div');
  veliaRow.className = 'zRow veliaRow' + (atVelia ? ' current' : '');
  veliaRow.title = LANG==='fr' ? 'Velia — zone paisible' : 'Velia — peaceful zone';
  veliaRow.innerHTML =
    `<span class="zname">🏘️ Velia</span>` +
    `<span class="zBadge">${LANG==='fr'?'ZONE PAISIBLE':'PEACEFUL ZONE'}</span>` +
    `<span class="zreq" style="width:auto">${LANG==='fr'?'Aucun monstre':'No monsters'}</span>`;
  veliaRow.onclick = () => { if (!atVelia) goToVelia(); };
  list.appendChild(veliaRow);
  
  const upgradeZones = zonesOfferingUpgrade();
  GEAR_TIERS.forEach(tier => {
    const head = document.createElement('div');
    head.className = 'zTierHead';
    head.innerHTML = `<span class="zTierDot" style="background:${tier.color}"></span>${tier.label[LANG]}`;
    list.appendChild(head);
    tier.zones.forEach(i => {
      const z = ZONES[i];
      const b = badgeOf(bottleneck(z));
      const apOk = apRatio(z) >= 1, dpOk = dpRatio(z) >= 1;
      const previewed = lootPreviewIdx==null ? i===zoneIdx : i===lootPreviewIdx;
      const row = document.createElement('div');
      const isCurrent = !atVelia && i===zoneIdx;
      row.className = 'zRow' + (isCurrent?' current':'');
      row.dataset.zi = i; 
      row.title = tr(z.name);
      if (!isCurrent) row.style.borderLeftColor = tier.color;
      
      const pCount = (typeof zonePlayerCounts !== 'undefined' && zonePlayerCounts[i]) || 0;
      const hasUpgrade = upgradeZones.has(i);
      
      const adminHereTag = (typeof adminZoneIdx !== 'undefined' && adminZoneIdx === i)
        ? `<span class="zAdminTag" title="${LANG==='fr'?'Un admin est ici':'An admin is here'}">ADMIN</span>` : '';
      row.innerHTML =
        `<span class="zname">${tr(z.name)}</span>` +
        `<span class="zBadge ${b.cls}">${tr(b.txt.replace('ZONE ',''))}</span>` +
        `<span class="zreq"><span class="${apOk?'ok':'bad'}">${z.reqAP} PA</span> · <span class="${dpOk?'ok':'bad'}">${z.reqDP} PD</span></span>` +
        `<span class="zUpgradeIcon"${hasUpgrade?'':' style="visibility:hidden"'} title="${LANG==='fr'?'Meilleur stuff à trouver ici':'Better gear to find here'}">⬆️</span>` +
        
        `<span class="zPlayerCountWrap">${adminHereTag}<span class="zPlayerCount"${pCount?'':' style="visibility:hidden"'} title="${LANG==='fr'?'Joueurs actuellement sur cette zone':'Players currently on this zone'}">👥 ${pCount}</span></span>` +
        `<button class="zBtnView${previewed?' active':''}" title="${LANG==='fr'?'Voir le loot':'View loot'}">👁</button>`;
      row.querySelector('.zBtnView').onclick = e => { e.stopPropagation(); renderLootTable(i); };
      row.onclick = () => { if (atVelia || i !== zoneIdx) travelTo(i); };
      
      row.onmouseenter = () => highlightEquipSlotsForZone(slotsUpgradedByZone(i));
      row.onmouseleave = () => highlightEquipSlotsForZone([]);
      list.appendChild(row);
    });
  });
}

function updateZonePlayerCountBadges() {
  document.querySelectorAll('#zoneList .zRow:not(.veliaRow)').forEach(row => {
    const i = parseInt(row.dataset.zi, 10);
    const el = row.querySelector('.zPlayerCount'); if (!el) return;
    const n = (zonePlayerCounts && zonePlayerCounts[i]) || 0;
    el.textContent = `👥 ${n}`;
    el.style.visibility = n ? '' : 'hidden';
  });
}

function updateZoneViewHalo() {
  
  document.querySelectorAll('#zoneList .zRow:not(.veliaRow)').forEach(row => {
    const i = parseInt(row.dataset.zi, 10);
    const previewed = lootPreviewIdx==null ? i===zoneIdx : i===lootPreviewIdx;
    row.querySelector('.zBtnView').classList.toggle('active', previewed);
  });
}

function updateZoneTitleText() {
  if (atVelia) {
    $('ztName').textContent = LANG==='fr' ? 'Velia' : 'Velia';
    $('ztTier').textContent = LANG==='fr' ? 'Zone paisible' : 'Peaceful zone';
  } else {
    $('ztName').textContent = tr(Z().name);
    $('ztTier').textContent = Z().tier;
  }
}
function travelTo(i) {
  atVelia = false;
  
  const lt = $('lootTicker'); if (lt) lt.innerHTML = '';
  
  if (i > S.maxZoneIdx) logToDiscord('🗺️ Nouvelle zone', `**${myPseudo||'Joueur'}** atteint **${tr(ZONES[i].name)}** (${ZONES[i].tier}) pour la première fois`, 0x8fc98a);
  zoneIdx = i;
  if (i > S.maxZoneIdx) S.maxZoneIdx = i;
  S.travelCount = (S.travelCount||0) + 1;
  resetWorld();
  updateZoneTitleText();
  lootPreviewIdx = null; 
  renderLootTable();
  hud();
  buildZoneList();
  
  renderEquipment();
}

function updateVeliaPlayersTicker() {
  const t = $('lootTicker'); if (!t || !atVelia) return;
  const label = LANG==='fr' ? `👥 En ville (${veliaPlayers.length})` : `👥 In town (${veliaPlayers.length})`;
  const rows = veliaPlayers.map(p => `<div class="veliaPlayerRow">${p.is_guest?'🎭':'👤'} ${escapeHtml(p.pseudo)}</div>`).join('');
  t.innerHTML = `<div class="veliaPlayersHead">${label}</div>` +
    (rows || `<div class="admHint">${LANG==='fr'?"Personne d'autre pour l'instant":'Nobody else right now'}</div>`);
}

function goToVelia() {
  atVelia = true;
  resetWorld();
  updateZoneTitleText();
  lootPreviewIdx = null;
  renderLootTable();
  hud();
  buildZoneList();
  renderEquipment(); 
  
  updateVeliaPlayersTicker();
  if (typeof refreshVeliaPlayers === 'function') refreshVeliaPlayers();
}

function die() {
  const stayedPut = (zoneIdx === P.faintZoneIdx) && (atVelia === P.faintAtVelia);
  if (stayedPut) goToVelia();
  P.hp = effHpMax()*.5;
  S.lastDeathAt = Date.now(); 
  const banner = $('deathBanner');
  if (banner) {
    banner.textContent = stayedPut
      ? (LANG==='fr'
        ? '⚠ Les monstres t\'ont tué ! Choisis une zone plus adaptée à ton niveau ou améliore ton stuff.'
        : '⚠ The monsters killed you! Pick a zone better suited to your level or improve your gear.')
      : (LANG==='fr'
        ? '⚠ Tu t\'es relevé — tu as changé de zone pendant le K.O.'
        : '⚠ You got back up — you changed zone during the K.O.');
    banner.classList.add('show');
    clearTimeout(die._t);
    die._t = setTimeout(() => banner.classList.remove('show'), 6000);
  }
}

function refreshStatsOnly() {
  const invFullEl = $('invFullBanner');
  if (invFullEl) invFullEl.classList.toggle('show', invUsed() >= INV_SIZE);
  const dangerEl = $('dangerBanner');
  if (dangerEl) dangerEl.classList.toggle('show', !atVelia && isZoneDangerous());
  const apR = apRatio(), dpR = dpRatio(), z = Z();
  $('silver').textContent = fmt(S.silver);
  $('invLvl').textContent = S.lvl;
  $('invXpPct').textContent = fmtXpPct(S.xp / S.xpNext * 100);
  
  const eqSumLvlEl = $('eqSumLvl'), eqSumXpEl = $('eqSumXp');
  if (eqSumLvlEl) eqSumLvlEl.textContent = (LANG==='fr'?'Niv. ':'Lvl ') + S.lvl;
  if (eqSumXpEl) eqSumXpEl.textContent = fmtXpPct(S.xp / S.xpNext * 100);
  $('stPS').textContent = Math.round(GS());
  
  $('stPA').textContent = Math.floor(apEff());
  $('stDP').textContent = Math.floor(totalDP());
  $('stHpMax').textContent = fmt(Math.round(effHpMax()));
  $('stMpMax').textContent = fmt(Math.round(effManaMax()));
  $('stSpd').textContent = '+' + Math.round(totalSpdPct()) + '%';
  $('stDodge').textContent = Math.round(totalDodgePct(dpR)*10)/10 + '%';
  
  const ztComp = $('ztCompendium');
  if (ztComp) {
    const zc = compendiumZoneCount(), complete = zc >= ZONES.length;
    ztComp.textContent = (complete ? '📖✓ ' : '📖 ') + zc + '/' + ZONES.length;
    ztComp.className = complete ? 'complete' : '';
  }
  const apEl = $('stApZone');
  const dpEl = $('stDpZone');
  if (atVelia) {
    apEl.textContent = LANG==='fr' ? '—' : '—'; apEl.className = 'v';
    dpEl.textContent = '—'; dpEl.className = 'v';
  } else {
    apEl.textContent = Math.floor(apEff()) + ' / ' + z.reqAP;
    apEl.className = 'v ' + (apR >= 1 ? 'ok' : 'bad');
    dpEl.textContent = Math.floor(totalDP()) + ' / ' + z.reqDP;
    dpEl.className = 'v ' + (dpR >= 1 ? 'ok' : 'bad');
  }
  $('stMode').textContent = tr(aiMode());
  $('stKills').textContent = S.kills;
  $('stLoot').textContent = S.lootCount;
  const mins = (performance.now()-S.startTime)/60000;
  const kpmNow = mins>.1 ? (S.kills-(S.killsAtLoad||0))/mins : 0;
  $('stKpm').textContent = mins>.1 ? kpmNow.toFixed(1) : '—';
  
  if (mins > 2 && kpmNow > (S.bestKpm||0)) {
    
    if (kpmNow - (S.bestKpm||0) > 0.5) logToDiscord('🏹 Record kills/min', `**${myPseudo||'Joueur'}** bat son record perso : **${kpmNow.toFixed(1)}** kills/min (${tr(Z().name)})`, 0xc9a55a);
    S.bestKpm = kpmNow;
  }
  
  const tokenGain = S.tokenSilverEarned-(S.tokenSilverEarnedAtLoad||0);
  const silverPerMinNow = mins>.1 ? tokenGain/mins : 0;
  if (mins > 2) {
    const silverPerHourNow = tokenGain/(mins/60);
    if (silverPerHourNow > (S.bestSilverPerHour||0)) S.bestSilverPerHour = silverPerHourNow;
  }
  $('shRate').textContent = mins>.1
    ? fmt(Math.round(silverPerMinNow))+' silver/min'+(S.bestSilverPerHour ? ' · record '+fmt(Math.round(S.bestSilverPerHour))+'/h' : '')
    : '— silver/min';
  
  const gsNow = GS(), apNow = apEff(), dpNow = totalDP();
  if (gsNow > (S.bestGearscore||0)) S.bestGearscore = gsNow;
  if (apNow > (S.bestAp||0)) S.bestAp = apNow;
  if (dpNow > (S.bestDp||0)) S.bestDp = dpNow;
  const zb = $('zoneBadge');
  if (atVelia) {
    zb.className = 'b-green'; zb.textContent = LANG==='fr'?'ZONE PAISIBLE':'PEACEFUL ZONE';
    $('ztReq').textContent = LANG==='fr' ? 'Aucun monstre' : 'No monsters';
  } else {
    const b = badgeOf(bottleneck());
    zb.className = b.cls; zb.textContent = tr(b.txt);
    
    zb.title = b.cls === 'b-red'
      ? (LANG==='fr' ? '⚠️ Zone trop dure pour ton stuff : tu es ralenti, les monstres qui t\'ont repéré sont plus rapides' : '⚠️ Zone too hard for your gear: you are slowed down, monsters that spotted you are faster')
      : '';
    $('ztReq').innerHTML = `<span class="${apR>=1?'ok':'bad'}">${Math.floor(apEff())}/${z.reqAP} PA</span> · <span class="${dpR>=1?'ok':'bad'}">${Math.floor(totalDP())}/${z.reqDP} PD</span>`;
  }
}

let lastInvSig = '', lastZoneSig = '';
function invSignature() {
  let s = '';
  for (let i = 0; i < INV_SIZE; i++) { const it = INV[i]; s += it ? (it.key+','+it.qty+','+(it.enhLv||0)) : '_'; s += '|'; }
  
  for (const k of Object.keys(EQUIP)) { const e = EQUIP[k]; s += e ? (e.key+','+(e.enhLv||0)) : '_'; s += '|'; }
  return s;
}
function zoneSignature() { return zoneIdx + ':' + atVelia + ':' + Math.round(apEff()) + ':' + Math.round(totalDP()); }

const CONTENT_UPDATE_VERSION = {
  wiki:         { v:2, desc:{fr:'1 arme garantie sur les 3 dernières zones de chaque palier (plus rien sur la 1ère)',en:'1 guaranteed weapon on a tier\'s last 3 zones (none on the 1st)'} },
  compendium:   { v:1, desc:{fr:'Clique un objet pour voir dans quelles zones le farmer',en:'Click an item to see which zones farm it'} },
  codex:        { v:1, desc:{fr:'Liste à jour de tous les objets du jeu',en:'Up to date list of every item in the game'} },
  achievements: { v:1, desc:{fr:'Filtres par catégorie et "pas fini" disponibles',en:'Category and "unfinished" filters available'} },
};
function contentSeenKey(panel) { return 'velia-idle-seenv-'+panel; }
function contentLastSeenVersion(panel) {
  try { return parseInt(localStorage.getItem(contentSeenKey(panel))||'0', 10) || 0; } catch(e) { return 0; }
}
function contentIsUnread(panel) {
  const entry = CONTENT_UPDATE_VERSION[panel]; if (!entry) return false;
  return entry.v > contentLastSeenVersion(panel);
}

function markContentSeen(panel) {
  const entry = CONTENT_UPDATE_VERSION[panel]; if (!entry) return;
  try { localStorage.setItem(contentSeenKey(panel), String(entry.v)); } catch(e) {}
  refreshContentNewBadges();
}

function contentChangeCalloutHtml(panel) {
  if (!contentIsUnread(panel)) return '';
  const entry = CONTENT_UPDATE_VERSION[panel]; if (!entry || !entry.desc) return '';
  return `<div class="contentNewCallout">🆕 ${escapeHtml(entry.desc[LANG]||entry.desc.fr)}</div>`;
}
function refreshContentNewBadges() {
  const map = { wiki:'newBadgeWiki', compendium:'newBadgeCompendium', codex:'newBadgeCodex', achievements:'newBadgeAchievements' };
  for (const key in map) {
    const el = $(map[key]); if (!el) continue;
    el.textContent = '1';
    el.classList.toggle('show', contentIsUnread(key));
  }
}

function hud() {
  refreshStatsOnly();
  drawZoneMobIcon();
  renderFarmModeBtn();
  const zSig = zoneSignature();
  
  if (zSig !== lastZoneSig) { lastZoneSig = zSig; buildZoneList(); syncFarmCardHeights(); }
  const iSig = invSignature();
  if (iSig !== lastInvSig) { lastInvSig = iSig; refreshInvUI(); }
  
  const invSilverEl = $('invSilver'); if (invSilverEl) invSilverEl.textContent = fmt(S.silver);
  const invLoyaltyEl2 = $('invLoyalty'); if (invLoyaltyEl2) invLoyaltyEl2.textContent = '🏅 '+fmt(S.loyalty||0);
  ensureQuests('daily');
  ensureQuests('weekly');
  checkAchievements();
  updateQuestBadge();
  renderQuestWidget();
  renderQuestTrackerWidget();
  ensureLoyaltyGrant();
  updateMailBadge();
  refreshContentNewBadges();
  
  if (typeof updatePatchBadge === 'function') updatePatchBadge();
  
  const equipBestBtn = $('btnEquipBest');
  if (equipBestBtn) equipBestBtn.classList.toggle('hasUpgrade', hasNeglectedUpgradeInBag());
}

function syncFarmCardHeights() {
  const statsCard = $('statsCard');
  if (!statsCard) return;
  const targetH = statsCard.getBoundingClientRect().height;
  if (targetH < 50) return; 
  [['zonesCard','zoneList'], ['lootCard','lootTable']].forEach(([cardId, listId]) => {
    const card = $(cardId), list = $(listId);
    if (!card || !list) return;
    const overhead = card.getBoundingClientRect().height - list.getBoundingClientRect().height; 
    const newListH = Math.max(80, Math.round(targetH - overhead));
    list.style.maxHeight = newListH + 'px';
  });
}
window.addEventListener('resize', () => { if (typeof syncFarmCardHeights === 'function') syncFarmCardHeights(); });
function hudFast() {
  $('stateName').textContent = STATE_FR[P.state]||P.state;
  if (P.hp > effHpMax()) P.hp = effHpMax(); 
  const hpPct = Math.max(0,P.hp/effHpMax()*100);
  $('hpFill').style.width = hpPct+'%';
  $('hpPct').textContent = Math.round(hpPct)+'%';
  
  if (P.mp > effManaMax()) P.mp = effManaMax();
  const mpPct = Math.max(0,P.mp/effManaMax()*100);
  $('mpFill').style.width = mpPct+'%';
  $('mpPct').textContent = Math.round(mpPct)+'%';
  $('manaPotCd').style.height = (P.manaPotCd/MANA_POTION.cd*100)+'%';
  const pot = POTIONS[S.potionType] || POTIONS.medium;
  $('potCd').style.height = (P.potCd/pot.cd*100)+'%';
  
  const dualIcon = $('potDualIcon');
  if (dualIcon && !dualIcon.dataset.set) { dualIcon.innerHTML = ICO_POTION_DUO; dualIcon.dataset.set = '1'; }
  const potCostNow = potionCost(pot.cost), manaCostNow = potionCost(MANA_POTION.cost);
  $('potSlot').title = pot.name[LANG] + (potCostNow>0 ? ` — ${fmt(potCostNow)} silver/${LANG==='fr'?'usage':'use'} (+${Math.round(effHpMax()*pot.heal)} PV, ${Math.round(pot.heal*100)}%, CD ${pot.cd}s)` : (LANG==='fr'?` — gratuite (CD ${pot.cd}s)`:` — free (CD ${pot.cd}s)`)) +
    ' · ' + MANA_POTION.name[LANG] + ` — ${fmt(manaCostNow)} silver/${LANG==='fr'?'usage':'use'} (+${Math.round(MANA_POTION.restore*100)}% MP, CD ${MANA_POTION.cd}s, auto)`;
  for (const s of SKILLS) {
    const el = skEls[s.id];
    el.querySelector('.cd').style.height = (cds[s.id]/s.cd*100)+'%';
    el.classList.toggle('cast', P.castingSkill===s);
    el.classList.toggle('buffed', s.type==='buff' && buffTimer>0);
  }
  renderCastBar();
}

function renderCastBar() {
  const bar = $('castBar');
  if (!P.castingSkill) { bar.classList.remove('show'); return; }
  bar.classList.add('show');
  const remain = Math.max(0, 1 - P.castProgress);
  $('castBarLeft').style.transform = `scaleX(${remain})`;
  $('castBarRight').style.transform = `scaleX(${remain})`;
  $('castBarLabel').textContent = P.castingSkill.name;
}

let last = performance.now();

function advanceSim(now) {
  const dt = Math.min(2, (now-last)/1000); last = now;
  if (dt <= 0) return;
  
  if (bossState.active) return;
  
  if (!atVelia && packs.filter(p=>!p.dead).length < targetPackCount()) spawnPackNear();
  
  packs = packs.filter(p=>!p.dead);
  corpses.forEach(c=>c.life-=dt); corpses = corpses.filter(c=>c.life>0);
  floats.forEach(f=>f.life-=dt); floats = floats.filter(f=>f.life>0);

  fsm(dt);
  wolvesTick(dt);
  dropsTick(dt);
  particlesTick(dt);

  cam.x += (P.x-cam.x)*Math.min(1,dt*4);
  cam.y += (P.y-cam.y)*Math.min(1,dt*4);
}
function loop(now) {
  if (bossState.active) { requestAnimationFrame(loop); return; }
  advanceSim(now);
  render(now/1000);
  hudFast();
  requestAnimationFrame(loop);
}

setInterval(() => { if (document.hidden) advanceSim(performance.now()); }, 1000);

function getSaveState() {
  return {
    version: 1,
    S: { ...S },
    EQUIP: JSON.parse(JSON.stringify(EQUIP)),
    INV: JSON.parse(JSON.stringify(INV)),
    COMPENDIUM_BAG: JSON.parse(JSON.stringify(COMPENDIUM_BAG)),
    VELIA_CHEST: JSON.parse(JSON.stringify(VELIA_CHEST)),
    zoneIdx,
    playerPos: { x: P.x, y: P.y },
    savedAt: new Date().toISOString(),
  };
}
function applySaveState(data) {
  if (!data || data.version !== 1) return false;
  Object.assign(S, data.S);
  
  S.startTime = performance.now();
  S.silverEarnedAtLoad = S.silverEarned || 0;
  S.tokenSilverEarnedAtLoad = S.tokenSilverEarned || 0;
  S.killsAtLoad = S.kills || 0;
  Object.keys(EQUIP).forEach(k => EQUIP[k] = data.EQUIP[k] ?? null);
  for (let i = 0; i < INV_SIZE; i++) INV[i] = data.INV[i] ?? null;
  
  for (let i = 0; i < INV_SIZE; i++) COMPENDIUM_BAG[i] = data.COMPENDIUM_BAG?.[i] ?? null;
  
  for (let i = 0; i < INV_SIZE; i++) VELIA_CHEST[i] = data.VELIA_CHEST?.[i] ?? null;
  if (!S.migratedGearRebalanceV158) { migrateGearRebalanceV158(); S.migratedGearRebalanceV158 = true; }
  if (!S.migratedEarringRebalanceV175) { migrateEarringRebalanceV175(); S.migratedEarringRebalanceV175 = true; }
  if (!S.migratedArmorNoApV192) { migrateArmorNoApV192(); S.migratedArmorNoApV192 = true; }
  if (!S.migratedJewelryApV207) { migrateJewelryApV207(); S.migratedJewelryApV207 = true; }
  if (!S.migratedGearFixedStatsV226) { migrateGearFixedStatsV226(); S.migratedGearFixedStatsV226 = true; }
  if (!S.migratedGearRescaleV235) { migrateGearRescaleV235(); S.migratedGearRescaleV235 = true; }
  if (!S.migratedJewelryMatNameV239) { migrateJewelryMatNameV239(); S.migratedJewelryMatNameV239 = true; }
  if (!S.migratedGearRescaleV243) { migrateGearRescaleV243(); S.migratedGearRescaleV243 = true; }
  if (!S.migratedGearRescaleV245) { migrateGearRescaleV245(); S.migratedGearRescaleV245 = true; }
  if (!S.migratedPenMasteryV308) { migratePenMasteryV308(); S.migratedPenMasteryV308 = true; }
  zoneIdx = data.zoneIdx || 0;
  S.maxZoneIdx = Math.max(S.maxZoneIdx||0, zoneIdx); 
  S.xpNext = xpNeededFor(S.lvl); 
  if (!POTIONS[S.potionType]) S.potionType = 'medium'; 
  
  if (data.playerPos) { P.x = data.playerPos.x; P.y = data.playerPos.y; }
  resetWorld(true); 
  updateZoneTitleText(); 
  hud();
  return true;
}

function exportSaveToFile() {
  const blob = new Blob([JSON.stringify(getSaveState(), null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'velia-idle-save.json';
  a.click();
}

function importSaveFromFile(file) {
  const reader = new FileReader();
  reader.onload = e => { try { applySaveState(JSON.parse(e.target.result)); } catch(err) { console.error('Sauvegarde invalide', err); } };
  reader.readAsText(file);
}

window.getSaveState = getSaveState;
window.applySaveState = applySaveState;
window.exportSaveToFile = exportSaveToFile;
window.importSaveFromFile = importSaveFromFile;

// ==== src/classes/sorcier/sorcier-render.js ====
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
  
}

const CHAR_TIER_PALETTE = {
  grey:  { robe:'#6f7d8a', hat:'#586773', hatDark:'#465360', horn:false, cape:false, trim:'#c9a55a' },
  white: { robe:'#c3c9cc', hat:'#9aa0a3', hatDark:'#7a8083', horn:false, cape:false, trim:'#e8e8e8' },
  green: { robe:'#3d4a3a', hat:'#26301f', hatDark:'#182015', horn:true,  cape:false, trim:'#7aa35e' },
  blue:  { robe:'#20303c', hat:'#16232b', hatDark:'#0a1216', horn:true,  cape:true,  trim:'#6ea3c9' },
};

const ORNAMENT_TIER = {
  grey:  { n:1, flash:.28 },
  white: { n:2, flash:.45 },
  green: { n:4, flash:.72 },
  blue:  { n:5, flash:1.0 },
};

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

function witchBodyOn(g, t, castingSkill) {
  const casting = !!castingSkill;
  const sway = Math.sin(P.bob*.9)*2;
  const grade = gearVisualTier() || 'grey';
  const pal = CHAR_TIER_PALETTE[grade];
  
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
  
  if (pal.horn) {
    g.fillStyle = pal.trim;
    g.beginPath(); g.moveTo(-9,-32); g.quadraticCurveTo(-14,-40,-11,-48); g.quadraticCurveTo(-9,-40,-6,-33); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(9,-32); g.quadraticCurveTo(14,-40,11,-48); g.quadraticCurveTo(9,-40,6,-33); g.closePath(); g.fill();
  }
  
  const staffAng = casting ? -0.5+Math.sin(t*10*jitterMult)*.08 : 0.18;
  g.save(); g.translate(9,-14); g.rotate(staffAng);
  g.strokeStyle='#6b5a42'; g.lineWidth=2.6; g.lineCap='round';
  g.beginPath(); g.moveTo(0,22); g.lineTo(0,-22); g.stroke();
  
  const glowColor = casting ? castColor : pal.trim;
  const glow = casting ? .85+Math.sin(t*12*jitterMult)*.15 : .4;
  
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
  
  if (EQUIP.awakening) {
    const ang = t*1.4;
    [[Math.cos(ang)*16, Math.sin(ang)*7-10, 3.2], [Math.cos(ang+Math.PI)*11, Math.sin(ang+Math.PI)*5-6, 2.4]].forEach(([ox,oy,r]) => {
      g.fillStyle = hexToRgba(pal.trim,.9);
      g.beginPath(); g.arc(ox, oy-20, r, 0, 7); g.fill();
    });
  }
  
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
    
    if (casting && orn.flash >= .7) {
      g.fillStyle = hexToRgba(ornColor, alpha*.3);
      g.beginPath(); g.arc(ox, oy, size*2.2, 0, 7); g.fill();
    }
  }
}
function witchBody(t,castingSkill) { witchBodyOn(ctx, t, castingSkill); }

// ==== src/progression/achievements-data.js ====
const ACHIEVEMENTS = [
  { id:'first_kill',   icon:'🗡️', name:{fr:'Premier sang',        en:'First blood'},        desc:{fr:'Terrasse ton premier monstre',              en:'Defeat your first monster'},               statFn:S=>S.kills,               target:1,               reward:300 },
  { id:'kills_100',    icon:'⚔️', name:{fr:'Chasseur',            en:'Hunter'},              desc:{fr:'Terrasse 100 monstres',                     en:'Defeat 100 monsters'},                     statFn:S=>S.kills,               target:100,             reward:1500 },
  { id:'kills_1000',   icon:'⚔️', name:{fr:'Exterminateur',       en:'Exterminator'},        desc:{fr:'Terrasse 1 000 monstres',                   en:'Defeat 1,000 monsters'},                   statFn:S=>S.kills,               target:1000,            reward:8000 },
  { id:'kills_10000',  icon:'💀', name:{fr:'Faucheur',            en:'Reaper'},              desc:{fr:'Terrasse 10 000 monstres',                  en:'Defeat 10,000 monsters'},                  statFn:S=>S.kills,               target:10000,           reward:40000 },
  { id:'loot_1',       icon:'🎒', name:{fr:'Premier butin',       en:'First loot'},          desc:{fr:'Ramasse ton premier objet',                 en:'Pick up your first item'},                 statFn:S=>S.lootCount,           target:1,               reward:200 },
  { id:'loot_500',     icon:'🎒', name:{fr:'Collectionneur',      en:'Collector'},           desc:{fr:'Ramasse 500 objets',                        en:'Loot 500 items'},                          statFn:S=>S.lootCount,           target:500,             reward:4000 },
  { id:'loot_5000',    icon:'🎒', name:{fr:'Accumulateur',        en:'Hoarder'},             desc:{fr:'Ramasse 5 000 objets',                      en:'Loot 5,000 items'},                        statFn:S=>S.lootCount,           target:5000,            reward:25000 },
  { id:'silver_10k',   icon:'🪙', name:{fr:'Petite fortune',      en:'Small fortune'},       desc:{fr:'Gagne 10 000 silver au total',              en:'Earn a total of 10,000 silver'},           statFn:S=>S.silverEarned,        target:10000,           reward:1000 },
  { id:'silver_100k',  icon:'🪙', name:{fr:'Marchand',            en:'Merchant'},            desc:{fr:'Gagne 100 000 silver au total',             en:'Earn a total of 100,000 silver'},          statFn:S=>S.silverEarned,        target:100000,          reward:5000 },
  { id:'silver_1m',    icon:'💰', name:{fr:'Riche marchand',      en:'Wealthy merchant'},    desc:{fr:'Gagne 1 000 000 silver au total',           en:'Earn a total of 1,000,000 silver'},        statFn:S=>S.silverEarned,        target:1000000,         reward:20000 },
  { id:'silver_10m',   icon:'💰', name:{fr:'Magnat',              en:'Tycoon'},              desc:{fr:'Gagne 10 000 000 silver au total',          en:'Earn a total of 10,000,000 silver'},       statFn:S=>S.silverEarned,        target:10000000,        reward:100000 },
  { id:'zone_2',       icon:'🗺️', name:{fr:'Explorateur',         en:'Explorer'},            desc:{fr:'Atteins la 2e zone de farm',                en:'Reach the 2nd farming zone'},              statFn:S=>S.maxZoneIdx+1,        target:2,               reward:1500 },
  { id:'zone_6',       icon:'🗺️', name:{fr:'Aventurier',          en:'Adventurer'},          desc:{fr:'Atteins la 6e zone de farm',                en:'Reach the 6th farming zone'},              statFn:S=>S.maxZoneIdx+1,        target:6,               reward:15000 },
  { id:'zone_last',    icon:'🏔️', name:{fr:'Conquérant de Velia', en:'Conqueror of Velia'},  desc:{fr:'Atteins la dernière zone de farm',          en:'Reach the final farming zone'},            statFn:S=>S.maxZoneIdx+1,        target:ZONES.length,    reward:120000 },
  { id:'gs_50',        icon:'🛡️', name:{fr:'Bien équipé',         en:'Well equipped'},       desc:{fr:'Atteins 50 de Gearscore',                   en:'Reach 50 Gearscore'},                      statFn:()=>GS(),                 target:50,              reward:5000 },
  { id:'gs_150',       icon:'🛡️', name:{fr:'Vétéran équipé',      en:'Veteran gear'},        desc:{fr:'Atteins 150 de Gearscore',                  en:'Reach 150 Gearscore'},                     statFn:()=>GS(),                 target:150,             reward:25000 },
  { id:'gs_300',       icon:'🛡️', name:{fr:'Légende vivante',     en:'Living legend'},       desc:{fr:'Atteins 300 de Gearscore',                  en:'Reach 300 Gearscore'},                     statFn:()=>GS(),                 target:300,             reward:90000 },
  { id:'enh_pri',      icon:'✨', name:{fr:'Étincelle divine',    en:'Divine spark'},        desc:{fr:'Amène une pièce d\'équipement au niveau PRI',en:'Bring one piece of gear to PRI level'},    statFn:()=>maxEnhLv(),           target:PRI_IDX,         reward:20000 },
  { id:'enh_max',      icon:'🌟', name:{fr:'Perfection',          en:'Perfection'},          desc:{fr:'Amène une pièce d\'équipement au niveau PEN (max)', en:'Bring one piece of gear to PEN (max) level'}, statFn:()=>maxEnhLv(), target:ENH_NAMES.length-1, reward:150000 },
  { id:'jackpot_1',    icon:'💎', name:{fr:'Coup de chance',      en:'Lucky strike'},        desc:{fr:'Trouve ton premier bijou rare',             en:'Find your first rare jewelry drop'},       statFn:S=>S.jackpotCount||0,     target:1,               reward:2000 },
  { id:'gear_1',       icon:'⚙️', name:{fr:'Nouvel équipement',   en:'New gear'},            desc:{fr:'Trouve ta première pièce d\'équipement',    en:'Find your first piece of gear'},           statFn:S=>S.gearDropCount||0,    target:1,               reward:800 },
  { id:'playtime_1h',  icon:'⏱️', name:{fr:'Habitué',             en:'Regular'},             desc:{fr:'Joue pendant 1 heure au total',             en:'Play for a total of 1 hour'},              statFn:S=>S.playtimeSec,         target:3600,            reward:1500 },
  { id:'playtime_10h', icon:'⏱️', name:{fr:'Dévoué',              en:'Dedicated'},           desc:{fr:'Joue pendant 10 heures au total',           en:'Play for a total of 10 hours'},            statFn:S=>S.playtimeSec,         target:36000,           reward:12000 },
  { id:'treasure_1',   icon:'🗺️', name:{fr:'Chercheur de trésor', en:'Treasure seeker'},     desc:{fr:'Trouve ton premier morceau du Trésor de Velia', en:'Find your first Velia Treasure piece'},  statFn:S=>treasureTotal(S),      target:1,               reward:5000 },
  { id:'treasure_10',  icon:'🗺️', name:{fr:'Chasseur de trésor',  en:'Treasure hunter'},     desc:{fr:'Trouve 10 morceaux du Trésor de Velia (tous types)', en:'Find 10 Velia Treasure pieces (any type)'}, statFn:S=>treasureTotal(S), target:10,              reward:30000 },
];

const ACH_CATS = {
  combat:      { icon:'⚔️', label:{fr:'Combat',en:'Combat'} },
  butin:       { icon:'🎒', label:{fr:'Butin',en:'Loot'} },
  silver:      { icon:'🪙', label:{fr:'Silver',en:'Silver'} },
  playtime:    { icon:'⏱️', label:{fr:'Temps de jeu',en:'Playtime'} },
  exploration: { icon:'🗺️', label:{fr:'Exploration',en:'Exploration'} },
  equipment:   { icon:'🛡️', label:{fr:'Équipement',en:'Equipment'} },
  treasure:    { icon:'🗺️', label:{fr:'Trésor de Velia',en:'Velia Treasure'} },
};
function achCat(id) {
  if (id === 'first_kill' || id.startsWith('kills')) return 'combat';
  if (id.startsWith('loot')) return 'butin';
  if (id.startsWith('silver')) return 'silver';
  if (id.startsWith('playtime')) return 'playtime';
  if (id.startsWith('treasure')) return 'treasure';
  if (id.startsWith('zone')) return 'exploration';
  return 'equipment'; 
}

// ==== src/progression/treasure-craft.js ====
const VELIA_TREASURE = [
  { name:'Bout du trésor de Velia', ch:.0017,   icon:'🧩', color:'#c9a55a', key:'treasure_bout_velia' }, 
  { name:'Trésor de Velia',         ch:.000005, icon:'🗺️', color:'#e8c96a', key:'treasure_velia' },      
];

function treasureTotal(S) {
  let total = 0;
  for (const t of new Set(VELIA_TREASURE.map(x => x.name))) total += S.lootByItem[t] || 0;
  return total;
}

function referenceGearVal() {
  const zone = Z(), tier = gearTierForZone(zoneIdx);
  const basisAP = zone.gearBasisAP ?? zone.reqAP, basisDP = zone.gearBasisDP ?? zone.reqDP;
  const slot = (ZONE_ARMOR_SLOTS[zoneIdx] || GEAR_SLOTS)[0];
  const role = GEAR_ROLE[slot];
  const ap = role.apShare ? gearFloor(basisAP * role.apShare) : 0;
  const dp = role.dpShare ? gearFloor(basisDP * role.dpShare) : 0;
  const hp = role.hpShare ? gearFloor(basisDP * role.hpShare * HP_GEAR_SCALE) : 0;
  return Math.round((ap*2 + dp + hp*0.5) * GEAR_SELL_MULT);
}

const TREASURE_STACK_CAP = { treasure_bout_velia:100, treasure_velia:1 };
function enforceTreasureStackCap(slot) {
  if (!slot || slot.kind !== 'treasure') return;
  const cap = TREASURE_STACK_CAP[slot.key]; if (!cap) return;
  if (slot.qty > cap) {
    const excess = slot.qty - cap;
    addSilver(excess * (slot.val||0), 'sell', slot.name);
    slot.qty = cap;
  }
}

const TREASURE_PIECE_RECIPES = [
  { needKey:'treasure_bout_velia', needQty:100, giveName:'Trésor de Velia', giveKey:'treasure_velia' },
];
function invSlotByKey(key) { return INV.findIndex(s => s && s.key === key); }
function invQtyByKey(key) { const i = invSlotByKey(key); return i===-1 ? 0 : INV[i].qty; }

function invHasRoomFor(key) { return invSlotByKey(key) !== -1 || invUsed() < INV_SIZE; }
function craftTreasurePiece(recipe) {
  if (invQtyByKey(recipe.needKey) < recipe.needQty) return false;
  if (!invHasRoomFor(recipe.giveKey)) { floatTxt(P.x,P.y,90,LANG==='fr'?'Sac plein !':'Bag full!',{hurt:true}); return false; }
  invRemoveAt(invSlotByKey(recipe.needKey), recipe.needQty);
  invAdd({ name:recipe.giveName, kind:'treasure', icon:'🗺️', color:'#e8c96a', key:recipe.giveKey, qty:1, stackable:true, weight:0.05, val:referenceGearVal()*10000, ap:0, dp:0, hp:0, dodge:0 });
  trackLoot(recipe.giveName);
  floatTxt(P.x,P.y,90,'🗺️ '+recipe.giveName,{gold:true});
  logToDiscord('🔧 Craft', `**${myPseudo||'Joueur'}** combine ${recipe.needQty} morceaux en 1 ${recipe.giveName}`, 0xe8c96a);
  renderInventory();
  return true;
}

const SECRET_COMBO_SILVER_MULT = 300;
function secretComboReady() {
  return invSlotByKey('treasure_velia') !== -1
    && invSlotByKey('treasure_heidel') !== -1
    && invSlotByKey('treasure_calpheon') !== -1;
}
function craftSecretCombo() {
  const vIdx = invSlotByKey('treasure_velia');
  const hIdx = invSlotByKey('treasure_heidel');
  const cIdx = invSlotByKey('treasure_calpheon');
  if (vIdx === -1 || hIdx === -1 || cIdx === -1) return false;
  invRemoveAt(vIdx, 1); invRemoveAt(hIdx, 1); invRemoveAt(cIdx, 1);
  const reward = Math.round(referenceGearVal() * SECRET_COMBO_SILVER_MULT);
  
  addSilver(reward, 'loot', 'Coffret secret');
  floatTxt(P.x,P.y,90,'🎁 +'+fmt(reward),{gold:true});
  logToDiscord('🎁 Coffret secret', `**${myPseudo||'Joueur'}** combine les 3 Trésors régionaux pour ${fmt(reward)} silver`, 0xe8c96a);
  renderInventory();
  return true;
}

function renderTreasureCraftPanel() {
  
  const el = $('treasureCraftPanel'); if (!el) return;
  const pieceRows = TREASURE_PIECE_RECIPES.map(r => {
    const have = invQtyByKey(r.needKey);
    const ok = have >= r.needQty;
    return `<button class="craftRecipeBtn${ok?' ready':''}" data-kind="piece" data-key="${r.needKey}" ${ok?'':'disabled'}>` +
      `🧩 ${have}/${r.needQty} → 🗺️ ${escapeHtml(r.giveName)}</button>`;
  }).join('');
  const secretOk = secretComboReady();
  const secretRow = `<button class="craftRecipeBtn${secretOk?' ready':''}" data-kind="secret" ${secretOk?'':'disabled'} ` +
    `title="${LANG==='fr'?'1 Trésor de Velia + 1 Trésor de Heidel + 1 Trésor de Calpheon → silver (Heidel/Calpheon pas encore débloqués)':'1 Velia Treasure + 1 Heidel Treasure + 1 Calpheon Treasure → silver (Heidel/Calpheon not unlocked yet)'}">` +
    `🗺️+🗺️+🗺️ → 🎁 ${LANG==='fr'?'Coffret secret':'Secret box'}</button>`;
  
  const upcomingRows = Object.entries(TIER_PREVIEW_CARD).map(([tierId, card]) => {
    const tierLabel = ZONE_TIERS.find(t => t.id === tierId).label[LANG];
    return `<button class="craftRecipeBtn" disabled title="${LANG==='fr'?'Bientôt disponible — palier '+tierLabel+' pas encore ouvert':'Coming soon — '+tierLabel+' tier not yet open'}">` +
      `🔒 🧩 0/100 → ${card.icon} ${escapeHtml(tr(card.name))}</button>`;
  }).join('');
  el.innerHTML = `<div class="craftPanelTitle">${LANG==='fr'?'🔧 Combiner':'🔧 Combine'}</div>` +
    `<div class="craftRecipes">${pieceRows}${secretRow}${upcomingRows}</div>`;
  el.querySelectorAll('.craftRecipeBtn[data-kind="piece"]').forEach(btn => {
    btn.onclick = () => { const r = TREASURE_PIECE_RECIPES.find(x => x.needKey === btn.dataset.key); if (r) craftTreasurePiece(r); renderTreasureCraftPanel(); };
  });
  const secretBtn = el.querySelector('.craftRecipeBtn[data-kind="secret"]');
  if (secretBtn) secretBtn.onclick = () => { craftSecretCombo(); renderTreasureCraftPanel(); };
}

// ==== src/progression/notifications-quests.js ====
function maxEnhLv() {
  let m = 0;
  for (const k of OPTIMIZABLE_SLOTS) { const e = EQUIP[k]; if (e && (e.enhLv||0) > m) m = e.enhLv||0; }
  return m;
}

let notifUnread = 0;
let notifSerial = 0; 

const NOTIF_MAX_AGE_MS = 7 * 24 * 3600 * 1000; 
const NOTIF_SHOW_LIMIT = 20; 
function pruneNotifLog() {
  const cutoff = Date.now() - NOTIF_MAX_AGE_MS;
  S.notifLog = (S.notifLog||[]).filter(n => n.t >= cutoff);
}
function pushNotif(icon, title, text, cat) {
  pruneNotifLog();
  S.notifLog.unshift({ id: ++notifSerial + '_' + Date.now(), icon, title, text, t: Date.now(), cat: cat || 'info' });
  if (S.notifLog.length > 200) S.notifLog.length = 200; 
  notifUnread++;
  updateNotifBadge();
}
function deleteNotif(id) {
  S.notifLog = (S.notifLog||[]).filter(n => n.id !== id);
  openNotifCenter(); 
}

async function logToDiscord(title, description, color) {
  if (!sb) return;
  try {
    const { data } = await sb.auth.getSession();
    const token = (data && data.session && data.session.access_token) || SUPABASE_ANON_KEY;
    await fetch(SUPABASE_URL + '/functions/v1/discord-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ title, description, color }),
    });
  } catch (e) {}
}
function updateNotifBadge() {
  const badge = $a('notifBadge'); if (!badge) return;
  badge.textContent = notifUnread > 9 ? '9+' : notifUnread;
  badge.classList.toggle('show', notifUnread > 0);
  
  const btn = $a('btnNotifCenter'); if (btn) btn.classList.toggle('hasNew', notifUnread > 0);
}

function fmtNotifTime(ts) {
  const d = new Date(ts);
  const hhmm = d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
  return d.getDate().toString().padStart(2,'0')+'/'+(d.getMonth()+1).toString().padStart(2,'0')+' '+hhmm;
}

function showResetNotice(icon, title, body) {
  $('resetNoticeIcon').textContent = icon || '🔔';
  $('resetNoticeTitle').textContent = title;
  $('resetNoticeBody').innerHTML = body;
  $('resetNoticeOverlay').classList.add('show');
  pushNotif(icon || '🔔', title, body.replace(/<[^>]+>/g, ''), 'important');
}
$('resetNoticeClose').onclick = () => $('resetNoticeOverlay').classList.remove('show');

async function checkPendingNotice() {
  if (!sb || !currentUser) return;
  try {
    const { data } = await sb.rpc('claim_pending_notice');
    const n = Array.isArray(data) ? data[0] : data;
    if (n && n.notice_key) {
      showResetNotice(n.icon, LANG==='fr' ? n.title_fr : n.title_en, LANG==='fr' ? n.body_fr : n.body_en);
    }
  } catch (e) {}
}

const NOTIF_CAT_META = {
  important: { fr:'⚠️ Important', en:'⚠️ Important' },
  success:   { fr:'🏆 Réussites', en:'🏆 Achievements' },
  info:      { fr:'📰 Activité',  en:'📰 Activity' },
};
function notifRowHtml(n) {
  return `<div class="notifRow ${n.cat}">
    <div class="notifIcon">${n.icon}</div>
    <div class="notifBody"><div class="notifTitle">${escapeHtml(n.title)}</div><div class="notifText">${escapeHtml(n.text)}</div></div>
    <div class="notifTime">${fmtNotifTime(n.t)}</div>
    <button class="notifDelBtn" data-id="${n.id}" title="${LANG==='fr'?'Supprimer':'Delete'}">✕</button>
  </div>`;
}
let notifCatFilter = 'all'; 
function openNotifCenter() {
  notifUnread = 0;
  updateNotifBadge();
  pruneNotifLog(); 
  const log = S.notifLog||[];
  if (!log.length) {
    openInfo(LANG==='fr' ? '🔔 Notifications' : '🔔 Notifications',
      `<div class="admEmpty">${LANG==='fr'?'Aucune notification pour l\'instant':'No notifications yet'}</div>`);
    return;
  }
  
  const shown = log.slice(0, NOTIF_SHOW_LIMIT);
  const important = shown.filter(n => n.cat === 'important');
  const success = shown.filter(n => n.cat === 'success');
  const info = shown.filter(n => n.cat === 'info');
  if (!['all','important','success','info'].includes(notifCatFilter)) notifCatFilter = 'all';
  const tabsHtml = `<div class="catTabs">
    <button class="catTab notifCatTab${notifCatFilter==='all'?' active':''}" data-cat="all">${LANG==='fr'?'Tout':'All'} <span class="notifSectionCount">${shown.length}</span></button>
    <button class="catTab notifCatTab${notifCatFilter==='important'?' active':''}" data-cat="important">${NOTIF_CAT_META.important[LANG]} <span class="notifSectionCount">${important.length}</span></button>
    <button class="catTab notifCatTab${notifCatFilter==='success'?' active':''}" data-cat="success">${NOTIF_CAT_META.success[LANG]} <span class="notifSectionCount">${success.length}</span></button>
    <button class="catTab notifCatTab${notifCatFilter==='info'?' active':''}" data-cat="info">${NOTIF_CAT_META.info[LANG]} <span class="notifSectionCount">${info.length}</span></button>
  </div>`;
  const section = (cat, items) => !items.length ? '' :
    `<div class="notifSectionTitle">${NOTIF_CAT_META[cat][LANG]} <span class="notifSectionCount">${items.length}</span></div>` +
    items.map(notifRowHtml).join('');
  const html = notifCatFilter === 'all'
    ? section('important', important) + section('success', success) + section('info', info)
    : (notifCatFilter === 'important' ? important : notifCatFilter === 'success' ? success : info).map(notifRowHtml).join('') ||
      `<div class="admEmpty">${LANG==='fr'?'Rien dans cette catégorie':'Nothing in this category'}</div>`;
  const summary = `<div class="notifSummary">${LANG==='fr'
    ? `${shown.length} affichée${shown.length>1?'s':''} (sur ${log.length}) · auto-supprimées après 7 jours`
    : `${shown.length} shown (of ${log.length}) · auto-deleted after 7 days`}</div>`;
  openInfo(LANG==='fr' ? '🔔 Notifications' : '🔔 Notifications', summary + tabsHtml + `<div class="notifScroll">${html}</div>`);
  $a('infoBody').querySelectorAll('.notifCatTab').forEach(btn => {
    btn.onclick = () => { notifCatFilter = btn.dataset.cat; openNotifCenter(); };
  });
  $a('infoBody').querySelectorAll('.notifDelBtn').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); deleteNotif(btn.dataset.id); };
  });
}

function checkAchievements() {
  let unlocked = false;
  for (const a of ACHIEVEMENTS) {
    if (S.achUnlocked[a.id]) continue;
    if (a.statFn(S) >= a.target) {
      S.achUnlocked[a.id] = Date.now();
      addSilver(a.reward, 'achievement', a.name.fr);
      showAchToast(a);
      pushNotif('🏅', LANG==='fr'?'Succès débloqué':'Achievement unlocked', a.name[LANG]+' (+'+fmt(a.reward)+' 🪙)', 'success');
      logToDiscord('🏅 Succès débloqué', `**${myPseudo||'Joueur'}** — ${a.name.fr} (+${fmt(a.reward)} 🪙)`, 0xc9a55a);
      unlocked = true;
    }
  }
  if (unlocked) refreshStatsOnly();
}
function showAchToast(a) {
  const stack = $('achToastStack'); if (!stack) return;
  const el = document.createElement('div');
  el.className = 'achToast';
  el.innerHTML = `<div class="achToastIcon">${a.icon}</div>` +
    `<div><div class="achToastTitle">${LANG==='fr'?'🏅 Succès débloqué':'🏅 Achievement unlocked'}</div>` +
    `<div class="achToastName">${a.name[LANG]}</div>` +
    `<div class="achToastReward">+${fmt(a.reward)} 🪙</div></div>`;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 4500);
}

function mailboxAdd(key, name, icon, qty) {
  const existing = S.mailbox.find(m => m.key === key);
  if (existing) existing.qty += qty;
  else S.mailbox.push({ key, name, icon, qty });
}
function showMailToast(icon, name, qty) {
  const stack = $('achToastStack'); if (!stack) return;
  const el = document.createElement('div');
  el.className = 'achToast';
  el.innerHTML = `<div class="achToastIcon">${icon}</div>` +
    `<div><div class="achToastTitle">${LANG==='fr'?'📬 Nouveau courrier':'📬 New mail'}</div>` +
    `<div class="achToastName">${name}</div>` +
    `<div class="achToastReward">+${fmt(qty)}</div></div>`;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, 4500);
}

function ensureLoyaltyGrant() {
  if (!saveReady) return; 
  const now = new Date();
  const key = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate();
  if (S.lastLoyaltyDate === key) return;
  S.lastLoyaltyDate = key;
  const name = 'Loyalties'; 
  mailboxAdd('loyalty', name, '🏅', 200);
  showMailToast('🏅', name, 200);
  updateMailBadge();
}

function claimLoyalty() {
  const m = S.mailbox.find(m => m.key === 'loyalty');
  if (!m || m.qty <= 0) return;
  S.loyalty = (S.loyalty||0) + m.qty;
  m.qty = 0;
  updateMailBadge();
  hud();
}

function suppressLoyaltyGrantForToday() {
  const now = new Date();
  S.lastLoyaltyDate = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate();
  S.loyalty = 0;
}
function updateMailBadge() {
  const badge = $('mailBadge'); if (!badge) return;
  const n = S.mailbox.reduce((sum,m) => sum + m.qty, 0);
  badge.textContent = fmt(n);
  badge.classList.toggle('show', n > 0);
}
function renderMailboxHtml() {
  const stockRow = `<div class="admSummary">${LANG==='fr'?'Stock de Loyalties déjà récupéré':'Already claimed Loyalty stock'} : <b>${fmt(S.loyalty||0)}</b> 🏅</div>`;
  if (!S.mailbox.length || !S.mailbox.some(m => m.qty > 0)) {
    return stockRow + `<div class="admEmpty">${LANG==='fr'?'Ton courrier est vide':'Your mailbox is empty'}</div>`;
  }
  return stockRow + S.mailbox.filter(m => m.qty > 0).map(m => `<div class="achRow">` +
    `<div class="achIcon">${m.icon}</div>` +
    `<div class="achInfo"><div class="achName">${m.name}</div></div>` +
    `<div class="achReward">×${fmt(m.qty)}</div>` +
    (m.key === 'loyalty' ? `<button class="mailClaimBtn" data-key="${m.key}">${LANG==='fr'?'Récupérer':'Claim'}</button>` : '') +
    `</div>`).join('') +
    `<div class="admSummary">${LANG==='fr'?'Ces objets restent ici en permanence tant qu\'ils ne sont pas récupérés — ils ne se perdent jamais et s\'empilent sans limite.':'These items stay here permanently until claimed — they never get lost and stack without limit.'}</div>`;
}
function openMailbox() {
  openInfo(LANG==='fr' ? '📬 Courrier' : '📬 Mailbox', renderMailboxHtml());
  $a('infoBody').querySelectorAll('.mailClaimBtn').forEach(btn => {
    btn.onclick = () => { if (btn.dataset.key === 'loyalty') claimLoyalty(); openMailbox(); };
  });
}

let achPanelCat = 'all';       
let achOnlyUnfinished = false; 
function achRowHtml(a) {
  const val = a.statFn(S), done = !!S.achUnlocked[a.id];
  const pct = Math.max(0, Math.min(100, Math.round((val/a.target)*100)));
  return `<div class="achRow${done?' done':''}">` +
    `<div class="achIcon">${a.icon}</div>` +
    `<div class="achInfo"><div class="achName">${a.name[LANG]}</div><div class="achDesc">${a.desc[LANG]}</div>` +
    `<div class="achBarWrap"><div class="achBar" style="width:${pct}%"></div></div>` +
    `<div class="achProgress">${done ? (LANG==='fr'?'Terminé ✓':'Completed ✓') : fmt(Math.min(val,a.target))+' / '+fmt(a.target)}</div></div>` +
    `<div class="achReward">+${fmt(a.reward)} 🪙</div></div>`;
}
function renderAchievementsHtml() {
  const doneCount = ACHIEVEMENTS.filter(a => S.achUnlocked[a.id]).length;
  
  const cats = [['all', {icon:'🏅', label:{fr:'Tout',en:'All'}}], ...Object.entries(ACH_CATS)];
  const tabsHtml = cats.map(([id, meta]) => {
    const list = id==='all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => achCat(a.id)===id);
    const remaining = list.filter(a => !S.achUnlocked[a.id]).length;
    const badge = remaining>0 ? `<span class="qCountBadge">${remaining}</span>` : `<span class="qCountBadge done">✓</span>`;
    return `<button class="catTab achCatTab${id===achPanelCat?' active':''}" data-cat="${id}">${meta.icon} ${meta.label[LANG]} ${badge}</button>`;
  }).join('');
  
  const filterBtn = `<button id="achUnfinishedBtn" class="achFilterBtn${achOnlyUnfinished?' on':''}">${achOnlyUnfinished?(LANG==='fr'?'☑ Pas fini':'☑ Unfinished'):(LANG==='fr'?'☐ Pas fini':'☐ Unfinished')}</button>`;
  let list = achPanelCat==='all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => achCat(a.id)===achPanelCat);
  if (achOnlyUnfinished) list = list.filter(a => !S.achUnlocked[a.id]);
  const rows = list.length ? list.map(achRowHtml).join('')
    : `<div class="admEmpty">${LANG==='fr'?'Rien à afficher ici':'Nothing to show here'}</div>`;
  return `<div class="achSummary">${doneCount} / ${ACHIEVEMENTS.length}</div>` +
    `<div class="catTabs">${tabsHtml}</div>${filterBtn}${rows}`;
}
function openAchievements() {
  const callout = contentChangeCalloutHtml('achievements');
  openInfo(LANG==='fr'?'🏅 Succès':'🏅 Achievements', callout + renderAchievementsHtml());
  markContentSeen('achievements');
  $a('infoBody').querySelectorAll('.achCatTab').forEach(btn => {
    btn.onclick = () => { achPanelCat = btn.dataset.cat; openAchievements(); };
  });
  const fb = $a('achUnfinishedBtn');
  if (fb) fb.onclick = () => { achOnlyUnfinished = !achOnlyUnfinished; openAchievements(); };
}

function compendiumItemDone(name) { return (S.lootByItem[name]||0) > 0; }

function compendiumHighlightItem(name) {
  document.querySelectorAll('.compZoneRow').forEach(r => r.classList.remove('compHalo'));
  const matches = [];
  ZONES.forEach((z,zi) => {
    const tier = gearTierForZone(zi);
    const names = [tr(z.loot.trash.name), tr(tier.material.name), tr(z.loot.jackpot.name), tr(z.loot.craft.name)];
    if (names.includes(name)) matches.push(zi);
  });
  matches.forEach(zi => { const row = document.querySelector(`.compZoneRow[data-zi="${zi}"]`); if (row) row.classList.add('compHalo'); });
  const picker = $a('compZonePicker'); if (!picker) return;
  picker.innerHTML = matches.length
    ? `<b>${escapeHtml(name)}</b> ${LANG==='fr'?'— clique une zone pour y farmer directement :':'— click a zone to go farm there directly:'} ` +
      matches.map(zi => `<button class="compGoZoneBtn" data-zi="${zi}" title="${LANG==='fr'?'Lance le farm dans cette zone immédiatement':'Starts farming in this zone immediately'}">${tr(ZONES[zi].name)}</button>`).join('')
    : `<span class="admEmpty">${LANG==='fr'?'Aucune zone trouvée pour cet objet':'No zone found for this item'}</span>`;
  picker.querySelectorAll('.compGoZoneBtn').forEach(btn => {
    btn.onclick = () => {
      const zi = parseInt(btn.dataset.zi,10);
      if (atVelia || zi !== zoneIdx) travelTo(zi);
      $a('infoOverlay').classList.remove('open');
    };
  });
}

let compendiumTab = 'zones'; 
function renderCompendiumHtml() {
  const zc = compendiumZoneCount(), bc = compendiumBossCount();
  const total = compendiumTotalCount(), max = compendiumTotalMax(), pct = compendiumPct();
  const bossCountMax = Object.keys(BOSS_ROSTER).length;
  const penItems = penMasteryItemList(), penDone = compendiumPenCount();
  const summaryCard = `<button id="compTutoBtn" class="compTutoBtn" title="${LANG==='fr'?'Lancer le tutoriel du Compendium':'Start the Compendium tutorial'}">?</button>
    <div class="admStatTiles">
      <div class="admStatTile"><div class="astLbl">📖 ${LANG==='fr'?'Progression':'Progress'}</div><div class="astVal">${total} / ${max}</div></div>
      <div class="admStatTile"><div class="astLbl">🏃 SPD</div><div class="astVal">+${pct}%</div></div>
      <div class="admStatTile"><div class="astLbl">⚔️ ${LANG==='fr'?'Dégâts':'DMG'}</div><div class="astVal">+${pct}%</div></div>
      <div class="admStatTile"><div class="astLbl">🛡️ ${LANG==='fr'?'Esquive':'Dodge'}</div><div class="astVal">+${pct}%</div></div>
    </div>
    <div class="admSummary">${LANG==='fr'?`${zc}/${ZONES.length} zones · ${bc}/${bossCountMax} World Boss · ${penDone}/${penItems.length} PEN`:`${zc}/${ZONES.length} zones · ${bc}/${bossCountMax} World Bosses · ${penDone}/${penItems.length} PEN`}</div>
    <div class="admHint">${LANG==='fr'
      ? 'Chaque zone visitée (au moins 1 objet ramassé) ET chaque World Boss vaincu débloque +1% Vitesse, +1% Dégâts, +1% Esquive (additif, jamais un multiplicateur). Clique sur un objet ci-dessous pour voir dans quelles zones le farmer, puis clique une zone pour y lancer le farm directement (aucune confirmation, tu y es téléporté aussitôt).'
      : 'Every visited zone (at least 1 item looted) AND every defeated World Boss unlocks +1% Speed, +1% Damage, +1% Dodge (additive, never a multiplier). Click an item below to see which zones farm it, then click a zone to start farming there right away (no confirmation, you\'re sent there instantly).'}</div>
    <div id="compZonePicker" class="compZonePicker"></div>
    <div class="catTabs">
      <button class="catTab compTab${compendiumTab==='zones'?' active':''}" data-tab="zones">🗺️ ${LANG==='fr'?'Zones':'Zones'} (${zc}/${ZONES.length})</button>
      <button class="catTab compTab${compendiumTab==='bosses'?' active':''}" data-tab="bosses">🐋 World Bosses (${bc}/${bossCountMax})</button>
      <button class="catTab compTab${compendiumTab==='pen'?' active':''}" data-tab="pen">🌟 ${LANG==='fr'?'Maîtrise PEN':'PEN Mastery'} (${penDone}/${penItems.length})</button>
    </div>`;
  let bodyHtml;
  if (compendiumTab === 'bosses') {
    bodyHtml = Object.entries(BOSS_ROSTER).map(([id,b]) => {
      const unlocked = !!S.bossesKilled[id];
      return `<div class="achRow${unlocked?' done':''}">` +
        `<div class="achIcon">${b.icon}</div>` +
        `<div class="achInfo"><div class="achName">${b.name[LANG]}</div>` +
        `<div class="achDesc">${unlocked?(LANG==='fr'?'Vaincu au moins une fois':'Defeated at least once'):(LANG==='fr'?'Pas encore vaincu':'Not defeated yet')}</div></div>` +
        `<div class="achReward">${unlocked?'+1% ✓':'🔒'}</div></div>`;
    }).join('');
  } else if (compendiumTab === 'pen') {
    bodyHtml = `<div class="admHint">${LANG==='fr'
        ? 'Suivi de complétion pur (pas de bonus de stats) : amène chaque pièce d\'équipement et chaque bijou à PEN (niveau max) au moins une fois dans ton inventaire.'
        : 'Pure completion tracker (no stat bonus): bring every gear piece and every jewel to PEN (max level) at least once in your inventory.'}</div>` +
      `<div class="compItems compPenGrid">` + penItems.map(name => {
        const done = !!S.penMastery[name];
        return `<span class="compItem compPenItem${done?' done':''}">${done?'✓':'○'} ${escapeHtml(tr(name))}</span>`;
      }).join('') + `</div>`;
  } else {
    
    bodyHtml = GEAR_TIERS.map(tier => {
      const rowsHtml = tier.zones.map(zi => {
        const z = ZONES[zi];
        const items = zoneItemNames(zi);
        const unlocked = zoneFullyCollected(zi);
        const itemsHtml = items.map(name => `<span class="compItem${compendiumItemDone(name)?' done':''}" data-item="${escapeHtml(name)}">${compendiumItemDone(name)?'✓':'○'} ${escapeHtml(name)}</span>`).join('');
        return `<div class="achRow compZoneRow${unlocked?' done':''}" data-zi="${zi}" style="--tier-color:${tier.color}">` +
          `<div class="achIcon">${unlocked?'📖':'🔒'}</div>` +
          `<div class="achInfo"><div class="achName">${tr(z.name)}</div>` +
          `<div class="achDesc compItems">${itemsHtml}</div></div>` +
          `<div class="achReward">${unlocked?'+1% ✓':(LANG==='fr'?'Objet manquant':'Missing item')}</div></div>`;
      }).join('');
      return `<div class="zTierHead"><span class="zTierDot" style="background:${tier.color}"></span>${tier.label[LANG]}</div>${rowsHtml}`;
    }).join('');
  }
  return summaryCard + bodyHtml;
}

let compTutoSeen = false;
try { compTutoSeen = localStorage.getItem('velia-idle-comp-tuto-seen') === '1'; } catch(e) {}

let cronTutoSeen = false;
try { cronTutoSeen = localStorage.getItem('velia-idle-cron-tuto-seen') === '1'; } catch(e) {}
function openCompendium() {
  const callout = contentChangeCalloutHtml('compendium');
  openInfo(LANG==='fr'?'📖 Compendium':'📖 Compendium', callout + renderCompendiumHtml());
  markContentSeen('compendium');
  const tutoBtn = $a('compTutoBtn');
  if (tutoBtn) tutoBtn.onclick = () => startCompendiumTutorial();
  if (!compTutoSeen) {
    compTutoSeen = true;
    try { localStorage.setItem('velia-idle-comp-tuto-seen', '1'); } catch(e) {}
    setTimeout(startCompendiumTutorial, 400);
  }
  $a('infoBody').querySelectorAll('.compTab').forEach(btn => {
    btn.onclick = () => { compendiumTab = btn.dataset.tab; openCompendium(); };
  });
  $a('infoBody').querySelectorAll('.compItem[data-item]').forEach(el => {
    el.onclick = () => compendiumHighlightItem(el.dataset.item);
  });
}

const QUEST_KINDS_DAILY = {
  kills:    { icon:'⚔️', name:{fr:'Terrasser des monstres',    en:'Defeat monsters'},  unit:{fr:'monstres',en:'monsters'}, variants:[{target:100,reward:2000},{target:250,reward:5000},{target:500,reward:9000}] },
  loot:     { icon:'🎒', name:{fr:'Ramasser du butin',         en:'Loot items'},       unit:{fr:'objets',en:'items'},       variants:[{target:80,reward:1800},{target:200,reward:4500},{target:400,reward:8000}] },
  silver:   { icon:'🪙', name:{fr:'Gagner du silver',          en:'Earn silver'},      unit:{fr:'silver',en:'silver'},      variants:[{target:5000,reward:1500},{target:15000,reward:4000},{target:40000,reward:9000}] },
  enh:      { icon:'✦',  name:{fr:'Tenter des optimisations',  en:'Attempt enhancements'}, unit:{fr:'tentatives',en:'attempts'}, variants:[{target:5,reward:1500},{target:15,reward:4000},{target:30,reward:8000}] },
  playtime: { icon:'⏱️', name:{fr:'Jouer',                     en:'Play time'},        unit:{fr:'min',en:'min'},            variants:[{target:600,reward:1500},{target:1800,reward:4000},{target:3600,reward:8000}], displayDiv:60 },
  travel:   { icon:'🗺️', name:{fr:'Changer de zone',           en:'Change zone'},      unit:{fr:'fois',en:'times'},         variants:[{target:1,reward:1000}] },
};

const QUEST_KINDS_WEEKLY = {
  killsBig:    { icon:'💀', name:{fr:'Grand massacre',           en:'Great slaughter'},   unit:{fr:'monstres',en:'monsters'}, variants:[{target:1500,reward:15000},{target:3000,reward:30000},{target:6000,reward:55000}] },
  silverBig:   { icon:'💰', name:{fr:'Grosse récolte de silver', en:'Big silver haul'},   unit:{fr:'silver',en:'silver'},      variants:[{target:50000,reward:10000},{target:150000,reward:25000},{target:400000,reward:60000}] },
  jackpot:     { icon:'💎', name:{fr:'Bijoux rares',             en:'Rare jewelry'},      unit:{fr:'bijoux',en:'jewels'},      variants:[{target:1,reward:8000},{target:3,reward:20000},{target:6,reward:45000}] },
  gear:        { icon:'⚙️', name:{fr:'Équipement trouvé',        en:'Gear found'},        unit:{fr:'pièces',en:'pieces'},      variants:[{target:2,reward:6000},{target:5,reward:15000},{target:10,reward:35000}] },
  enhSuccess:  { icon:'🌟', name:{fr:'Optimisations réussies',   en:'Successful enhancements'}, unit:{fr:'réussites',en:'successes'}, variants:[{target:10,reward:8000},{target:25,reward:20000},{target:50,reward:45000}] },
  playtimeBig: { icon:'⏱️', name:{fr:'Assiduité',               en:'Dedication'},        unit:{fr:'h',en:'h'},                variants:[{target:7200,reward:8000},{target:18000,reward:20000},{target:36000,reward:45000}], displayDiv:3600 },
};
const QUEST_SCOPES = {
  daily:  { stateKey:'dq', kinds:QUEST_KINDS_DAILY,  count:3, keyFn:d => d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate() },
  weekly: { stateKey:'wq', kinds:QUEST_KINDS_WEEKLY, count:3, keyFn:d => { const m = mondayOf(d); return m.getFullYear()+'-'+(m.getMonth()+1)+'-'+m.getDate(); } },
};
function mondayOf(d) { const day = (d.getDay()+6)%7; return new Date(d.getFullYear(), d.getMonth(), d.getDate()-day); }
function questStatValue(kind) {
  switch (kind) {
    case 'kills': case 'killsBig': return S.kills;
    case 'loot': return S.lootCount;
    case 'silver': case 'silverBig': return S.silverEarned;
    case 'enh': return S.enhAttempts;
    case 'enhSuccess': return S.enhSuccess||0;
    case 'playtime': case 'playtimeBig': return S.playtimeSec;
    case 'travel': return S.travelCount;
    case 'jackpot': return S.jackpotCount||0;
    case 'gear': return S.gearDropCount||0;
  }
  return 0;
}
function ensureQuests(scope) {
  const cfg = QUEST_SCOPES[scope];
  const key = cfg.keyFn(new Date());
  if (S[cfg.stateKey] && S[cfg.stateKey].date === key) return;
  const kinds = Object.keys(cfg.kinds);
  for (let i = kinds.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [kinds[i],kinds[j]] = [kinds[j],kinds[i]]; }
  const quests = kinds.slice(0,cfg.count).map(k => {
    const variants = cfg.kinds[k].variants;
    const v = variants[Math.floor(Math.random()*variants.length)];
    return { kind:k, target:v.target, reward:v.reward, claimed:false };
  });
  const base = {};
  for (const k of Object.keys(cfg.kinds)) base[k] = questStatValue(k);
  S[cfg.stateKey] = { date:key, quests, base };
}
function questProgress(scope, q) {
  const st = S[QUEST_SCOPES[scope].stateKey];
  return Math.max(0, questStatValue(q.kind) - st.base[q.kind]);
}
function claimQuest(scope, i) {
  ensureQuests(scope);
  const st = S[QUEST_SCOPES[scope].stateKey];
  const q = st.quests[i];
  
  if (!q || q.claimed || questProgress(scope,q) < q.target) return;
  q.claimed = true; addSilver(q.reward, 'quest', q.kind);
  refreshStatsOnly(); updateQuestBadge();
  
  renderQuestTrackerWidget();
  if (questsPanelOpen) openDailyQuests();
}
function updateQuestBadge() {
  ensureQuests('daily'); ensureQuests('weekly');
  let n = 0;
  for (const scope of ['daily','weekly']) {
    const st = S[QUEST_SCOPES[scope].stateKey];
    n += st.quests.filter(q => !q.claimed && questProgress(scope,q) >= q.target).length;
  }
  const badge = $('questBadge');
  if (badge) { badge.textContent = n; badge.classList.toggle('show', n > 0); }
}

function renderQuestSectionHtml(scope) {
  ensureQuests(scope);
  const cfg = QUEST_SCOPES[scope], st = S[cfg.stateKey];
  return Object.keys(cfg.kinds).map(kind => {
    const def = cfg.kinds[kind];
    const dv = def.displayDiv||1;
    const i = st.quests.findIndex(q => q.kind === kind);
    if (i === -1) {
      const minV = def.variants[0], maxV = def.variants[def.variants.length-1];
      const rangeTxt = def.variants.length > 1
        ? `${fmt(Math.floor(minV.target/dv))}–${fmt(Math.floor(maxV.target/dv))} ${def.unit[LANG]}`
        : `${fmt(Math.floor(minV.target/dv))} ${def.unit[LANG]}`;
      return `<div class="achRow inactive">` +
        `<div class="achIcon">${def.icon}</div>` +
        `<div class="achInfo"><div class="achName">${def.name[LANG]}</div><div class="achDesc">${rangeTxt}</div></div>` +
        `<div class="achReward">${LANG==='fr'?'Pas tirée ce cycle':'Not active this cycle'}</div>` +
      `</div>`;
    }
    const q = st.quests[i];
    const val = Math.min(questProgress(scope,q), q.target);
    const pct = Math.round(val/q.target*100);
    const doneNotClaimed = val >= q.target && !q.claimed;
    return `<div class="achRow${q.claimed?' done':''}">` +
      `<div class="achIcon">${def.icon}</div>` +
      `<div class="achInfo"><div class="achName">${def.name[LANG]}</div>` +
      `<div class="achDesc">${fmt(Math.floor(val/dv))} / ${fmt(Math.floor(q.target/dv))} ${def.unit[LANG]}</div>` +
      `<div class="achBarWrap"><div class="achBar" style="width:${pct}%"></div></div></div>` +
      (q.claimed ? `<div class="achReward">${LANG==='fr'?'Réclamé ✓':'Claimed ✓'}</div>`
        : doneNotClaimed ? `<button class="questClaimBtn" data-scope="${scope}" data-i="${i}">${LANG==='fr'?'Réclamer':'Claim'} +${fmt(q.reward)}🪙</button>`
        : `<div class="achReward">+${fmt(q.reward)} 🪙</div>`) +
      `</div>`;
  }).join('');
}

function questScopeCounts(scope) {
  ensureQuests(scope);
  const st = S[QUEST_SCOPES[scope].stateKey];
  let claimable = 0, remaining = 0;
  st.quests.forEach(q => {
    if (q.claimed) return;
    if (questProgress(scope,q) >= q.target) claimable++; else remaining++;
  });
  return { claimable, remaining };
}
let questPanelScope = 'daily'; 
function renderDailyQuestsHtml() {
  const dailyNote = LANG==='fr' ? 'Se réinitialise chaque jour à minuit (heure locale)' : 'Resets every day at midnight (local time)';
  const weeklyNote = LANG==='fr' ? 'Se réinitialise chaque lundi à minuit (heure locale)' : 'Resets every Monday at midnight (local time)';
  const trackLabel = S.questTrackerOn
    ? (LANG==='fr'?'🔖 Ne plus suivre':'🔖 Stop tracking')
    : (LANG==='fr'?'🔖 Suivre les quêtes restantes':'🔖 Track remaining quests');
  
  const tabBtn = (scope, icon, label) => {
    const c = questScopeCounts(scope);
    const badge = c.claimable > 0
      ? `<span class="qCountBadge ready">${c.claimable} ✅</span>`
      : (c.remaining > 0 ? `<span class="qCountBadge">${c.remaining}</span>` : `<span class="qCountBadge done">✓</span>`);
    return `<button class="catTab qScopeTab${scope===questPanelScope?' active':''}" data-scope="${scope}">${icon} ${label} ${badge}</button>`;
  };
  const note = questPanelScope==='daily' ? dailyNote : weeklyNote;
  return `<button id="btnToggleTracker" onclick="toggleQuestTracker()">${trackLabel}</button>` +
    `<div class="catTabs">` +
      tabBtn('daily', '📅', LANG==='fr'?'Journalières':'Daily') +
      tabBtn('weekly', '🗓️', LANG==='fr'?'Hebdomadaires':'Weekly') +
    `</div>` +
    `<div id="questScopeBody">${renderQuestSectionHtml(questPanelScope)}<div class="admSummary">${note}</div></div>`;
}
let questsPanelOpen = false; 
function openDailyQuests() {
  openInfo(LANG==='fr'?'🗒️ Quêtes':'🗒️ Quests', renderDailyQuestsHtml());
  questsPanelOpen = true; 
  $a('infoBody').querySelectorAll('.qScopeTab').forEach(btn => {
    btn.onclick = () => { questPanelScope = btn.dataset.scope; openDailyQuests(); };
  });
  $a('infoBody').querySelectorAll('.questClaimBtn').forEach(btn => {
    
    btn.onclick = () => claimQuest(btn.dataset.scope, parseInt(btn.dataset.i,10));
  });
}

function toggleQuestTracker() {
  S.questTrackerOn = !S.questTrackerOn;
  renderQuestTrackerWidget();
  if ($a('infoOverlay').classList.contains('open')) openDailyQuests();
}

function nextAchievement() {
  let best = null, bestPct = -1;
  for (const a of ACHIEVEMENTS) {
    if (S.achUnlocked[a.id]) continue;
    const pct = Math.max(0, Math.min(99, (a.statFn(S)/a.target)*100));
    if (pct > bestPct) { bestPct = pct; best = { a, pct }; }
  }
  return best;
}
function fmtDuration(ms) {
  let s = Math.max(0, Math.floor(ms/1000));
  const days = Math.floor(s/86400); s -= days*86400;
  const h = Math.floor(s/3600); s -= h*3600;
  const m = Math.floor(s/60); s -= m*60;
  const pad = n => String(n).padStart(2,'0');
  return (days>0 ? days+(LANG==='fr'?'j ':'d ') : '') + pad(h)+':'+pad(m)+':'+pad(s);
}
function msToNextDailyReset() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0,0,0,0) - now;
}
function msToNextWeeklyReset() {
  const now = new Date();
  const day = (now.getDay()+6)%7; 
  const daysUntil = 7 - day;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()+daysUntil, 0,0,0,0) - now;
}
function fmtHours(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return h > 0 ? `${h}h${String(m).padStart(2,'0')}` : `${m}min`;
}

let resetWidgetFolded = isMobileViewport(), trackerWidgetFolded = isMobileViewport();
try { const v = localStorage.getItem('velia-idle-resetwidget-folded'); if (v !== null) resetWidgetFolded = v === '1'; } catch(e) {}
try { const v = localStorage.getItem('velia-idle-trackerwidget-folded'); if (v !== null) trackerWidgetFolded = v === '1'; } catch(e) {}
function toggleResetFold() { resetWidgetFolded = !resetWidgetFolded; try { localStorage.setItem('velia-idle-resetwidget-folded', resetWidgetFolded ? '1' : '0'); } catch(e) {} renderQuestWidget(); }
function toggleTrackerFold() { trackerWidgetFolded = !trackerWidgetFolded; try { localStorage.setItem('velia-idle-trackerwidget-folded', trackerWidgetFolded ? '1' : '0'); } catch(e) {} renderQuestTrackerWidget(); }

function renderQuestWidget() {
  const el = $('questWidget'); if (!el) return;
  ensureQuests('daily'); ensureQuests('weekly');
  const header = `<div class="qwHeaderRow"><span class="qwTitle">${LANG==='fr'?'🗒️ Suivi':'🗒️ Tracker'}</span>` +
    `<button class="qwFoldBtn" onclick="toggleResetFold()">${resetWidgetFolded?'▸':'▾'}</button></div>`;
  if (resetWidgetFolded) { el.innerHTML = header; return; }
  const next = nextAchievement();
  const todayPlaytime = S.playtimeSec - (S.dq && S.dq.base ? S.dq.base.playtime : 0);
  const dailyTip = LANG==='fr' ? 'Temps restant avant la remise à zéro des quêtes journalières' : 'Time left before daily quests reset';
  const weeklyTip = LANG==='fr' ? 'Temps restant avant la remise à zéro des quêtes hebdomadaires' : 'Time left before weekly quests reset';
  el.innerHTML = header + `<div class="qwBody">` +
    `<div class="qwRow" title="${dailyTip}"><span class="qwLbl">${LANG==='fr'?'🗒️ Journ.':'🗒️ Daily'}</span><span class="qwTimer">${fmtDuration(msToNextDailyReset())}</span></div>` +
    `<div class="qwRow" title="${weeklyTip}"><span class="qwLbl">${LANG==='fr'?'🗓️ Hebdo':'🗓️ Weekly'}</span><span class="qwTimer">${fmtDuration(msToNextWeeklyReset())}</span></div>` +
    `<div class="qwSep">${LANG==='fr'?'⏱️ Temps de jeu':'⏱️ Playtime'}</div>` +
    `<div class="qwRow"><span class="qwLbl">${LANG==='fr'?'Total':'Total'}</span><span class="qwTimer">${fmtHours(S.playtimeSec)}</span></div>` +
    `<div class="qwRow"><span class="qwLbl">${LANG==='fr'?'Aujourd\'hui':'Today'}</span><span class="qwTimer">${fmtHours(todayPlaytime)}</span></div>` +
    (next
      ? `<div class="qwNext"><div class="qwNextIcon">${next.a.icon}</div><div class="qwNextInfo">` +
        `<div class="qwNextName">${next.a.name[LANG]}</div>` +
        `<div class="achBarWrap"><div class="achBar" style="width:${Math.round(next.pct)}%"></div></div></div></div>`
      : `<div class="qwNext qwAllDone">${LANG==='fr'?'🏅 Vous avez fini les succès !':'🏅 You\'ve finished all achievements!'}</div>`) +
    `</div>`;
}

function renderQuestTrackerWidget() {
  const el = $('questTrackerWidget'); if (!el) return;
  if (!S.questTrackerOn) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';
  const header = `<div class="qwHeaderRow"><span class="qwTitle">${LANG==='fr'?'🔖 Quêtes suivies':'🔖 Tracked quests'}</span>` +
    `<button class="qwFoldBtn" onclick="toggleTrackerFold()">${trackerWidgetFolded?'▸':'▾'}</button></div>`;
  if (trackerWidgetFolded) { el.innerHTML = header; return; }
  ensureQuests('daily'); ensureQuests('weekly');
  let body = '';
  for (const scope of ['daily','weekly']) {
    const cfg = QUEST_SCOPES[scope], st = S[cfg.stateKey];
    const rows = [];
    st.quests.forEach((q,i) => {
      if (q.claimed) return;
      const def = cfg.kinds[q.kind];
      const val = Math.min(questProgress(scope,q), q.target);
      const pct = Math.round(val/q.target*100);
      const dv = def.displayDiv||1;
      const done = val >= q.target;
      
      const right = done
        ? `<button class="qwClaimBtn" data-scope="${scope}" data-i="${i}">+${fmt(q.reward)}🪙</button>`
        : '';
      rows.push(`<div class="qwTrackRow"><span class="qwTrackIcon">${def.icon}</span>` +
        `<div class="qwTrackInfo"><div class="qwTrackName">${def.name[LANG]}</div>` +
        `<div class="qwTrackNum">${fmt(Math.floor(val/dv))} / ${fmt(Math.floor(q.target/dv))} ${def.unit[LANG]}</div>` +
        `<div class="achBarWrap"><div class="achBar" style="width:${pct}%"></div></div></div>${right}</div>`);
    });
    if (rows.length) {
      body += `<div class="qwScopeLbl">${scope==='daily'?(LANG==='fr'?'📅 Journalières':'📅 Daily'):(LANG==='fr'?'🗓️ Hebdo':'🗓️ Weekly')}</div>` + rows.join('');
    }
  }
  el.innerHTML = header + `<div class="qwBody">` +
    (body || `<div class="qwEmpty">${LANG==='fr'?'Tout est réclamé !':'Everything is claimed!'}</div>`) +
    `</div>`;
  el.querySelectorAll('.qwClaimBtn').forEach(btn => {
    
    btn.onclick = () => claimQuest(btn.dataset.scope, parseInt(btn.dataset.i,10));
  });
}

function dmgMult(apR) {
  if (apR >= 1) return Math.min(1 + (apR - 1) * 0.5, 1.6);
  return Math.max(0.25, apR * apR);
}

function dmgTakenMult(dpR) {
  if (dpR < 1) return Math.min(4.5, 1 + (1 - dpR) * 3.2);
  return Math.max(0.4, 1 - (dpR - 1) * 0.35);
}

function lootMult(r) {
  if (r < 0.9) return Math.max(0.3, r * 0.85);
  return 1.0;
}

const REF_KPM_FOR_STATS = 15; 
const REF_DPS_FOR_STATS = 900; 

function zoneSilverPerHour(z) {
  const l = z.loot;
  return l.trash.val*l.trash.ch * REF_KPM_FOR_STATS * 60;
}
function zoneXpPerHour(z) { return z.xp * REF_KPM_FOR_STATS * 60; }
function zoneKillsPerMin(z) { return REF_DPS_FOR_STATS / z.hpPer; }

function bestZoneForMetric(metricFn) {
  let bestI = 0, bestV = -Infinity;
  for (let i = 0; i < ZONES.length; i++) {
    const v = metricFn(ZONES[i]);
    if (v > bestV) { bestV = v; bestI = i; }
  }
  return { i: bestI, v: bestV };
}
function badgeOf(r) {
  if (r < 0.6)  return { cls:'b-red',    txt:'ZONE DANGEREUSE' };
  if (r < 0.9)  return { cls:'b-orange', txt:'ZONE DIFFICILE' };
  if (r <= 1.3) return { cls:'b-green',  txt:'ZONE ADAPTÉE' };
  if (r <= 1.8) return { cls:'b-blue',   txt:'ZONE FACILE' };
  return { cls:'b-grey', txt:'ZONE DÉPASSÉE' };
}

function isZoneDangerous() { return bottleneck() < 0.6; }

const DANGER_PLAYER_SPEED_MULT = 0.5;
const DANGER_MOB_SPEED_MULT = 1.7;

let equipMode = 'gear';
const EQUIP_MODES = {
  gear:    { icon:'⚔️', name:{fr:'Équipement', en:'Gear'} },
  crystal: { icon:'💎', name:{fr:'Cristal',    en:'Crystal'} },
};
function renderEquipModeBtn() {
  const el = $('equipModeSlider'); if (!el) return;
  el.querySelectorAll('.equipModeSeg').forEach(seg => {
    const key = seg.dataset.mode, m = EQUIP_MODES[key];
    const active = equipMode === key;
    seg.classList.toggle('active', active);
    seg.title = m.name[LANG];
    seg.innerHTML = active ? `<span class="farmModeSegIcon">${m.icon}</span><span class="farmModeSegLabel">${m.name[LANG]}</span>` : `<span class="farmModeSegIcon">${m.icon}</span>`;
  });
  const gearPane = $('equipGearPane'), crystalPane = $('equipCrystalPane');
  if (gearPane) gearPane.style.display = equipMode === 'gear' ? '' : 'none';
  if (crystalPane) crystalPane.style.display = equipMode === 'crystal' ? '' : 'none';
  const crystalSlot = $('crystalSlotCenter');
  if (crystalSlot) crystalSlot.title = LANG==='fr' ? 'Bientôt disponible' : 'Coming soon';
}
function setEquipMode(key) {
  if (!EQUIP_MODES[key]) return;
  equipMode = key;
  renderEquipModeBtn();
}

// ==== src/combat/ai-mode.js ====
function aiMode() {
  return AI_COMBAT_MODES[S.aiCombatMode] ? S.aiCombatMode : 'équilibré';
}
const AI_COMBAT_MODES = {
  'défensif':  { icon:'🛡️', name:{fr:'Défensif',  en:'Defensive'} },
  'équilibré': { icon:'⚖️', name:{fr:'Équilibré', en:'Balanced'} },
  'overgeared':{ icon:'⚔️', name:{fr:'Offensif',  en:'Overgeared'} },
};
const AI_COMBAT_MODE_ORDER = ['défensif','équilibré','overgeared'];
function renderAiModeBtn() {
  const el = $('aiModeSlider'); if (!el) return;
  if (!AI_COMBAT_MODES[S.aiCombatMode]) S.aiCombatMode = 'équilibré';
  const titles = {
    'défensif':  LANG==='fr' ? 'IA défensive : esquive et soigne en priorité, quitte à moins attaquer' : 'Defensive AI: prioritizes dodging/healing over attacking',
    'équilibré': LANG==='fr' ? 'IA équilibrée : alterne attaque et prudence selon la situation' : 'Balanced AI: alternates attack and caution based on the fight',
    'overgeared':LANG==='fr' ? 'IA offensive : attaque sans relâche, ignore la plupart des esquives' : 'Overgeared AI: attacks relentlessly, skips most dodges',
  };
  el.querySelectorAll('.aiModeSeg').forEach(seg => {
    const key = seg.dataset.mode, m = AI_COMBAT_MODES[key];
    const active = S.aiCombatMode === key;
    seg.classList.toggle('active', active);
    seg.title = titles[key] || '';
    seg.innerHTML = active ? `<span class="farmModeSegIcon">${m.icon}</span><span class="farmModeSegLabel">${m.name[LANG]}</span>` : `<span class="farmModeSegIcon">${m.icon}</span>`;
  });
}
function setAiCombatMode(key) {
  if (!AI_COMBAT_MODES[key]) return;
  S.aiCombatMode = key;
  renderAiModeBtn();
}

const FARM_MODES = {
  loot: { icon:'🎒', name:{fr:'Loot', en:'Loot'} },
  xp:   { icon:'⚡', name:{fr:'XP',   en:'XP'} },
};
const FARM_MODE_ORDER = ['loot','xp'];

function renderFarmModeBtn() {
  const el = $('farmModeSlider'); if (!el) return;
  
  if (!FARM_MODES[S.farmMode]) S.farmMode = 'loot';
  const titles = {
    loot: LANG==='fr' ? 'IA "Loot" : ramasse tout le butin avant de passer au pack suivant' : 'Loot AI: picks up all drops before moving to the next pack',
    xp:   LANG==='fr' ? 'IA "XP" : enchaîne les packs sans ramasser le butin au sol' : 'XP AI: chains packs without picking up ground loot',
  };
  el.querySelectorAll('.farmModeSeg').forEach(seg => {
    const key = seg.dataset.mode, m = FARM_MODES[key];
    const active = S.farmMode === key;
    seg.classList.toggle('active', active);
    seg.title = titles[key] || '';
    seg.innerHTML = active ? `<span class="farmModeSegIcon">${m.icon}</span><span class="farmModeSegLabel">${m.name[LANG]}</span>` : `<span class="farmModeSegIcon">${m.icon}</span>`;
  });
}
function setFarmMode(key) {
  if (!FARM_MODES[key]) return;
  S.farmMode = key;
  renderFarmModeBtn();
}

// ==== src/combat/loot-rolls.js ====
const GEAR_SELL_MULT = 2.2;

const JACKPOT_VAL_TRASH_RATIO = 20;

const ALPHA_LOOT_CHANCE_MULT = 2;
function rollGearDrop(zone, alpha) {
  const tier = gearTierForZone(zoneIdx);
  const chance = gearDropChance(tier, zoneIdx);
  if (Math.random() > chance * (alpha ? ALPHA_LOOT_CHANCE_MULT : 1)) return null;
  
  const slot = (ZONE_ARMOR_SLOTS[zoneIdx] || GEAR_SLOTS)[0];
  const role = GEAR_ROLE[slot];
  
  const basisAP = zone.gearBasisAP ?? zone.reqAP, basisDP = zone.gearBasisDP ?? zone.reqDP;
  
  const ap = role.apShare ? gearFloor(basisAP * role.apShare) : 0;
  const dp = role.dpShare ? gearFloor(basisDP * role.dpShare) : 0;
  const hp = role.hpShare ? gearFloor(basisDP * role.hpShare * HP_GEAR_SCALE) : 0;
  const dodge = Math.round(basisDP * (role.dodgeShare||0) * DODGE_GEAR_SCALE * 100) / 100;
  
  const TIER_COLORED_ICON = { helmet: helmetIconForColor, armor: armorIconForColor, gloves: glovesIconForColor, boots: bootsIconForColor };
  const icon = TIER_COLORED_ICON[slot] ? TIER_COLORED_ICON[slot](tier.color, tier.grade) : (SLOT_ICON ? SLOT_ICON[slot] : '⚔️');
  return {
    name: tier.sets[slot], kind:'gear', slot, ap, dp, hp, dodge, enhLv:0, optimizable:true, fsByLevel:{},
    key:'gear_'+tier.grade+'_'+slot+'_'+Math.random().toString(36).slice(2,7),
    icon, color:tier.color, stackable:false, weight:1.2,
    matName: tier.material.name, 
    val: Math.round((ap*2 + dp + hp*0.5) * GEAR_SELL_MULT),
  };
}

function rollWeaponDrop(zone, alpha) {
  const tier = gearTierForZone(zoneIdx);
  const chance = gearDropChance(tier, zoneIdx);
  const slots = ZONE_WEAPON_SLOTS[zoneIdx] || ['weapon'];
  
  const TIER_COLORED_ICON = { weapon: staffIconForColor, secondary: daggerIconForColor, awakening: orbPairIconForColor };
  const out = [];
  for (const slot of slots) {
    if (Math.random() > chance * (alpha ? ALPHA_LOOT_CHANCE_MULT : 1)) continue;
    const role = GEAR_ROLE[slot];
    
    const basisAP = zone.gearBasisAP ?? zone.reqAP;
    const ap = gearFloor(basisAP * role.apShare);
    out.push({
      name: tier.sets[slot], kind:'gear', slot, ap, dp:0, hp:0, dodge:0, enhLv:0, optimizable:true, fsByLevel:{},
      key:'gear_'+tier.grade+'_'+slot+'_'+Math.random().toString(36).slice(2,7),
      icon: TIER_COLORED_ICON[slot] ? TIER_COLORED_ICON[slot](tier.color, tier.grade) : (SLOT_ICON ? SLOT_ICON[slot] : '⚔️'),
      color:tier.color, stackable:false, weight:1.2,
      matName: tier.material.name,
      val: Math.round(ap*2 * GEAR_SELL_MULT),
    });
  }
  return out;
}

function fmtTinyPct(ch) {
  const pct = ch * 100;
  if (pct <= 0) return '0%';
  const decimals = Math.min(8, Math.max(1, Math.ceil(-Math.log10(pct)) + 1));
  return pct.toFixed(decimals) + '%';
}

const ADMIN_TREASURE_KPM_REF = 15;
function fmtDurationMin(min) {
  if (min < 60) return Math.round(min) + ' min';
  const hours = min / 60;
  if (hours < 24) return hours.toFixed(1) + ' h';
  return (hours/24).toFixed(1) + ' j';
}
function rollDrops(wp, alpha, lm) {
  const zone = Z(), L = zone.loot;
  const zk = zoneIdx; 
  const mults = alpha ? ALPHA_LOOT_CHANCE_MULT : 1;
  
  const tier = gearTierForZone(zoneIdx);
  const tierMat = tier.material;
  
  const jSlot = accSlotFor(L.jackpot);
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const jackpotIcon = (JEWEL_ICON_FOR_SLOT[jSlot] || ringIconForTier)(jTierIdx, tier.color);
  
  const jackpotAp = gearFloor((zone.gearBasisAP ?? zone.reqAP) * GEAR_ROLE.jackpot.apShare);
  
  const jackpotVal = gearFloor(L.trash.val * JACKPOT_VAL_TRASH_RATIO);
  const table = [
    { ...L.trash,   kind:'trash',    color:'#a08464', key:'trash_'+zk,   icon:'▬', stackable:true,  weight:0.3 },
    { name:tierMat.name, val:L.mat.val, ch:L.mat.ch, kind:'material', color:tierMat.color, key:'mat_'+tierMat.name, icon:tierMat.icon, stackable:true, weight:0.1 },
    
    { ...L.jackpot, ch:jewelDropChance(tier, L.jackpot.ch), ap:jackpotAp, val:jackpotVal, kind:'jackpot',  color:tier.color, key:'acc_'+zk+'_'+Math.random().toString(36).slice(2,7), icon:jackpotIcon, stackable:false, weight:0.5, matName:tierMat.name },
    { ...L.craft,   kind:'craft',    color:'#b48ce8', key:'craft_'+L.craft.name, icon:'✦', stackable:true, weight:0.2, val:0 },
    
    ...VELIA_TREASURE.map(t => ({ name:t.name, val:referenceGearVal()*(t.key==='treasure_bout_velia'?10:10000), ch:t.ch, kind:'treasure', color:t.color, key:t.key, icon:t.icon, stackable:true, weight:0.05,
      pickupQty: t.key==='treasure_bout_velia' ? 1+Math.floor(Math.random()*3) : 1 })),
    
    { name:CRON_STONE.name, val:0, ch:CRON_STONE.ch, kind:'material', color:CRON_STONE.color, key:CRON_STONE.key,
      icon:CRON_STONE.icon, stackable:true, weight:0.1, pickupQty: 1+Math.floor(Math.random()*3) },
  ];
  for (const item of table) {
    if (Math.random() > item.ch * mults) continue;
    const a = Math.random()*Math.PI*2, r = 14+Math.random()*46;
    drops.push({
      x: wp.x + Math.cos(a)*r, y: wp.y + Math.sin(a)*r,
      item, taken:false,
      
      silver: item.kind === 'treasure' ? item.val : Math.ceil((item.val||0) * (alpha?1.6:1) * lm),
      age:0, pop:.35,
    });
  }
  const gear = rollGearDrop(zone, alpha);
  if (gear) {
    const a = Math.random()*Math.PI*2, r = 14+Math.random()*46;
    drops.push({ x: wp.x+Math.cos(a)*r, y: wp.y+Math.sin(a)*r, item: gear, taken:false, silver: gear.val, age:0, pop:.35 });
  }
  
  for (const weapon of rollWeaponDrop(zone, alpha)) {
    const a = Math.random()*Math.PI*2, r = 14+Math.random()*46;
    drops.push({ x: wp.x+Math.cos(a)*r, y: wp.y+Math.sin(a)*r, item: weapon, taken:false, silver: weapon.val, age:0, pop:.35 });
  }
}

const DESPAWN = 40;
let invFullWarned = 0;
let lastInvFullToast = 0;
function showInvFullWarning() {
  invFullWarned = 2;
  const el = $('invFullBanner');
  if (!el) return;
  el.classList.add('show');
  const now = performance.now();
  if (now - lastInvFullToast > 4000) { 
    lastInvFullToast = now;
    floatTxt(P.x, P.y-20, 70, LANG==='fr' ? 'SAC PLEIN !' : 'BAG FULL!', {hurt:true});
  }
}
function dropsTick(dt) {
  for (const l of drops) {
    if (l.taken) continue;
    l.age += dt; l.pop = Math.max(0,l.pop-dt);
    if (P.faint <= 0 && dist(P.x,P.y,l.x,l.y) < S.lootRadius) {
      const it = l.item;

      if (it.kind === 'trash') {
        addSilver(l.silver, 'loot', it.name);
        l.taken = true; S.lootCount++;
        lootLine(it, l.silver, 'trashLoot');
        floatTxt(l.x,l.y,40,it.name,{silver:true});
        particles.push({ type:'pickup', x:l.x, y:l.y, life:.35, max:.35, color:it.color });
        queueFarmEvent(it.kind, it.name, 1, l.silver);
        const zoneWasDone = zoneFullyCollected(zoneIdx); 
        trackLoot(it.name);
        checkZoneCompendiumUnlock(zoneIdx, zoneWasDone);
        continue;
      }

      const isOptimizable = it.kind === 'gear' || it.kind === 'jackpot';
      const obj = {
        
        key: it.key, name: it.name, kind: it.kind, icon: it.icon, color: it.color,
        qty: it.pickupQty || 1, stackable: it.stackable, weight: it.weight,
        val: l.silver, ap: it.ap||0, dp: it.dp||0, hp: it.hp||0, dodge: it.dodge||0, enhLv: it.enhLv||0,
        optimizable: isOptimizable, fsByLevel: isOptimizable ? {} : undefined,
        slot: it.kind==='jackpot' ? accSlotFor(it) : it.kind==='gear' ? it.slot : null,
        matName: it.matName, 
      };
      const ok = invAdd(obj);
      if (!ok) { 
        showInvFullWarning();
        continue;
      }
      l.taken = true;
      S.lootCount++;
      queueFarmEvent(it.kind, it.name, 1, l.silver);
      const zoneWasDone = zoneFullyCollected(zoneIdx); 
      trackLoot(it.name);
      checkZoneCompendiumUnlock(zoneIdx, zoneWasDone);
      if (it.kind === 'jackpot') {
        S.jackpotCount = (S.jackpotCount||0) + 1;
        
        lootLine(it, 0, 'jackpot');
        floatTxt(l.x,l.y,55,'★ '+it.name,{lvl:true});
        
        logToDiscord('💍 Bijou rare trouvé', `**${myPseudo||'Joueur'}** a trouvé ${it.name}`, 0xb48ce8);
      } else if (it.kind === 'gear') {
        S.gearDropCount = (S.gearDropCount||0) + 1;
        lootLine(it, 0, 'jackpot');
        floatTxt(l.x,l.y,55,'⚔ '+it.name,{lvl:true});
        logToDiscord('⚔️ Équipement rare trouvé', `**${myPseudo||'Joueur'}** a trouvé ${it.name}`, 0xb48ce8);
      } else if (it.kind === 'craft') {
        lootLine(it, 0, 'rare');
        floatTxt(l.x,l.y,40,it.name,{blue:true});
      } else if (it.kind === 'treasure') {
        lootLine(it, 0, 'rare');
        floatTxt(l.x,l.y,50,'🗺️ '+it.name,{lvl:true});
        
        logToDiscord('🗺️ Trésor de Velia', `**${myPseudo||'Joueur'}** trouve ${it.name} (${fmtTinyPct(it.ch)} de chance)`, 0xe8c96a);
      } else {
        lootLine(it, 0, it.kind === 'material' ? 'matLoot' : '');
        floatTxt(l.x,l.y,40,it.name,{silver:true});
        
        if (it.name === CRON_STONE.name && !cronTutoSeen) {
          cronTutoSeen = true;
          try { localStorage.setItem('velia-idle-cron-tuto-seen', '1'); } catch(e) {}
          setTimeout(startCronTutorial, 400);
        }
      }
      particles.push({ type:'pickup', x:l.x, y:l.y, life:.35, max:.35, color:it.color });
      if (invPanelOpen) renderInventory();
    }
  }
  drops = drops.filter(l => !l.taken && l.age < DESPAWN);
}

function accSlotFor(it) {
  const n = it.name.toLowerCase();
  
  if (n.includes('earring') || n.includes('boucle') || n.includes('oreille')) return 'earring';
  if (n.includes('necklace') || n.includes('collier')) return 'necklace';
  if (n.includes('belt') || n.includes('ceinture')) return 'belt';
  if (n.includes('ring') || n.includes('bague') || n.includes('anneau')) return 'ring';
  return 'ring'; 
}

function lootLine(item, val, cls) {
  const t = $('lootTicker');
  if (lastLootEntry && lastLootEntry.name === item.name && lastLootEntry.cls === (cls||'') && lastLootEntry.el.isConnected) {
    lastLootEntry.count++;
    lastLootEntry.val += val;
    lastLootEntry.el.innerHTML = `${escapeHtml(item.name)} ×${lastLootEntry.count}` + (lastLootEntry.val > 0 ? ` (🪙+${fmt(lastLootEntry.val)})` : '');
    return;
  }
  const div = document.createElement('div');
  if (cls) div.className = cls;
  div.innerHTML = val > 0 ? `${escapeHtml(item.name)} (🪙+${fmt(val)})` : escapeHtml(item.name);
  t.appendChild(div); 
  while (t.children.length > 15) t.removeChild(t.firstChild);
  lastLootEntry = { name:item.name, cls: cls||'', count:1, val, el:div };
}

function xpNeededFor(lvl) { return LEVEL_XP_TABLE[Math.min(lvl, LEVEL_XP_TABLE.length-1)]; }

function fmtXpPct(pct) {
  pct = Math.max(0, Math.min(99.999, pct));
  const [intPart, decPart] = pct.toFixed(3).split('.');
  return intPart.padStart(2,'0') + '.' + decPart + '%';
}

function flashXpGain() {
  const el = $('lvlXpRow'); if (!el) return;
  el.classList.remove('xpFlash');
  void el.offsetWidth; 
  el.classList.add('xpFlash');
  clearTimeout(flashXpGain._t);
  flashXpGain._t = setTimeout(() => el.classList.remove('xpFlash'), 500);
}
function gainXp(n) {
  if (n > 0) flashXpGain();
  S.xp += n;
  while (S.xp >= S.xpNext) {
    S.xp -= S.xpNext; S.lvl++;
    S.xpNext = xpNeededFor(S.lvl);
    S.hpMax += 8; P.hp = effHpMax();
    floatTxt(P.x,P.y,115,'NIVEAU '+S.lvl,{lvl:true});
    pushNotif('⭐', LANG==='fr'?'Niveau supérieur':'Level up', (LANG==='fr'?'Niveau ':'Level ')+S.lvl, 'info');
    
    logToDiscord('⭐ Niveau supérieur', `**${myPseudo||'Joueur'}** passe niveau **${S.lvl}** (SPD +${Math.round(levelSpdPct())}%)`, 0x9cc9e8);
    
    if (statsTab === 'levels') renderStatsLevelsPane();
  }
}

function floatTxt(x,y,z,txt,o={}){ floats.push({x,y,z,txt,life:o.lvl?1.6:1,...o}); }

// ==== src/combat/vfx.js ====
function spawnVfx(sk,p) {
  switch (sk.vfx) {
    case 'meteor':
      for (let i=0;i<5;i++)
        particles.push({type:'meteor',x:p.x+(Math.random()*110-55),y:p.y+(Math.random()*110-55),
          z:260+Math.random()*70,vz:-(430+Math.random()*130),life:1.4,max:1.4});
      break;
    case 'ice':
      for (let i=0;i<14;i++)
        particles.push({type:'ice',x:p.x+(Math.random()*100-50),y:p.y+(Math.random()*100-50),
          z:170+Math.random()*50,vz:-(300+Math.random()*110),life:1,max:1});
      break;
    case 'bolt':
      for (let i=0;i<3;i++)
        particles.push({type:'bolt',x:p.x+(Math.random()*70-35),y:p.y+(Math.random()*70-35),life:.28,max:.28});
      particles.push({type:'flash',life:.14,max:.14});
      break;
    case 'fire':
      particles.push({type:'fireOrb',x:P.x,y:P.y,tx:p.x,ty:p.y,t:0});
      break;
    case 'quake':
      particles.push({type:'quake',x:p.x,y:p.y,r:10,life:.55,max:.55});
      break;
    case 'spark':
      for (let i=0;i<8;i++)
        particles.push({type:'spark',x:p.x+(Math.random()*60-30),y:p.y+(Math.random()*60-30),
          z:10+Math.random()*30,vz:40+Math.random()*50,life:.45,max:.45});
      break;
  }
}

function spawnCastOriginVfx(sk) {
  const color = sk.castColor || '#c9a55a';
  switch (sk.castBurst) {
    case 'ember': 
      for (let i=0;i<3;i++)
        particles.push({type:'castOrigin',style:'ember',color,x:P.x+(Math.random()*16-8),y:P.y+(Math.random()*16-8),
          z:Math.random()*10,vz:26+Math.random()*14,life:.7,max:.7});
      break;
    case 'frost': 
      for (let i=0;i<6;i++) {
        const a = i/6*Math.PI*2;
        particles.push({type:'castOrigin',style:'frost',color,x:P.x+Math.cos(a)*14,y:P.y+Math.sin(a)*14,
          ang:a,life:.5,max:.5});
      }
      break;
    case 'crackle': 
      for (let i=0;i<5;i++)
        particles.push({type:'castOrigin',style:'crackle',color,x:P.x+(Math.random()*20-10),y:P.y+(Math.random()*20-10),
          z:14+Math.random()*18,life:.22,max:.22});
      break;
    case 'orb': 
      particles.push({type:'castOrigin',style:'orb',color,x:P.x,y:P.y,z:34,life:sk.castT,max:sk.castT});
      break;
    case 'dust': 
      for (let i=0;i<4;i++)
        particles.push({type:'castOrigin',style:'dust',color,x:P.x+(Math.random()*18-9),y:P.y+(Math.random()*10-5),
          life:.5,max:.5});
      break;
    case 'flash': 
      particles.push({type:'castOrigin',style:'flash',color,x:P.x,y:P.y,z:20,life:.18,max:.18});
      break;
    case 'flicker': 
      particles.push({type:'castOrigin',style:'flicker',color,x:P.x+(Math.random()*8-4),y:P.y+(Math.random()*8-4),
        z:20,life:.12,max:.12});
      break;
    case 'shimmer': 
      for (let i=0;i<3;i++)
        particles.push({type:'castOrigin',style:'shimmer',color,x:P.x+(Math.random()*20-10),y:P.y+(Math.random()*20-10),
          z:8+Math.random()*10,vz:8,life:.9,max:.9});
      break;
  }
}
function particlesTick(dt) {
  for (const q of particles) {
    if (q.life !== undefined) q.life -= dt;
    if (q.type==='meteor'||q.type==='ice') {
      q.z += q.vz*dt;
      if (q.z <= 0 && !q.boom) { q.boom = true; q.z = 0; q.life = Math.min(q.life,.2); }
    }
    if (q.type==='spark') { q.z += q.vz*dt; q.vz -= 200*dt; if (q.z<0) q.z=0; }
    if (q.type==='quake') q.r += 210*dt;
    if (q.type==='castOrigin' && (q.style==='ember'||q.style==='shimmer')) q.z += q.vz*dt;
    if (q.type==='fireOrb') {
      q.t += dt*3;
      if (q.t >= 1 && !q.done) {
        q.done = true; q.life = 0;
        for (let i=0;i<7;i++)
          particles.push({type:'spark',x:q.tx+(Math.random()*40-20),y:q.ty+(Math.random()*40-20),
            z:5+Math.random()*20,vz:50+Math.random()*70,life:.4,max:.4,fire:true});
      } else if (q.life === undefined) q.life = 1;
    }
  }
  particles = particles.filter(q => q.life===undefined || q.life>0);
}

// ==== src/combat/potions-logic.js ====
const POTION_KPM_REF = 15; 

const POTION_PCT_MIN = 0.0005; 
const POTION_PCT_MAX = 0.003;  
function potionHourlyIncome() {
  const z = (typeof atVelia !== 'undefined' && !atVelia && typeof Z === 'function') ? Z() : ZONES[0];
  return (z.loot.trash.val || 1) * POTION_KPM_REF * 60;
}
function potionCost(baseCost) {
  if (!baseCost) return 0;
  const lo = POTIONS.small.cost, hi = POTIONS.mega.cost;
  const t = hi > lo ? (baseCost - lo) / (hi - lo) : 0;
  const pct = POTION_PCT_MIN + t * (POTION_PCT_MAX - POTION_PCT_MIN);
  return Math.max(1, Math.round(potionHourlyIncome() * pct));
}

const ICO_POTION_DUO = `<svg class="gicon" viewBox="0 0 44 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 15 C 10 10, 20 7, 16 2" fill="none" stroke="#e88a8a" stroke-width="1.6" stroke-linecap="round" opacity=".7">
    <animate attributeName="d" values="M15 15 C 10 10, 20 7, 16 2;M15 15 C 20 10, 12 7, 17 2;M15 15 C 10 10, 20 7, 16 2" dur="3.2s" repeatCount="indefinite"/>
  </path>
  <path d="M25 16 C 30 10, 20 8, 24 2" fill="none" stroke="#8ab0e8" stroke-width="1.6" stroke-linecap="round" opacity=".7">
    <animate attributeName="d" values="M25 16 C 30 10, 20 8, 24 2;M25 16 C 21 10, 29 8, 23 2;M25 16 C 30 10, 20 8, 24 2" dur="3.2s" begin="1.6s" repeatCount="indefinite"/>
  </path>
  <g transform="translate(14,25) rotate(-12)">
    <circle cx="0" cy="4" r="8.5" fill="#7a1f24"/>
    <circle cx="0" cy="4" r="8.5" fill="none" stroke="#3a171a" stroke-width="1"/>
    <path d="M-1.8 2.5 h3.6 M0 0.6 v3.8" stroke="#ffb0b0" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="-2.2" y="-7" width="4.4" height="4.2" rx="1" fill="#5a3f22"/>
  </g>
  <g transform="translate(28,24) rotate(10)">
    <path d="M0 -4 C 4.2 1.5, 5.5 6.5, 3.8 11.5 Q 0 15.5 -3.8 11.5 C -5.5 6.5, -4.2 1.5, 0 -4 z" fill="#243a8a"/>
    <path d="M0 -4 C 4.2 1.5, 5.5 6.5, 3.8 11.5 Q 0 15.5 -3.8 11.5 C -5.5 6.5, -4.2 1.5, 0 -4 z" fill="none" stroke="#141f4a" stroke-width="1"/>
    <path d="M1.3 5 a2.4 2.4 0 1 1 -2 -3.6 a2 2 0 0 0 2 3.6 z" fill="#a8c4ff"/>
    <path d="M-1 -9 l1.2 -2.4 1.2 2.4 v3.2 h-2.4 z" fill="#5a7ac9"/>
  </g>
</svg>`;

let lastPotionSilverWarn = 0;
function warnPotionNoSilver() {
  const now = performance.now();
  if (now - lastPotionSilverWarn < 3000) return;
  lastPotionSilverWarn = now;
  floatTxt(P.x, P.y-15, 75, LANG==='fr' ? 'Pas assez de silver pour la potion !' : 'Not enough silver for a potion!', {hurt:true});
}
function usePotion() {
  const pot = POTIONS[S.potionType] || POTIONS.medium;
  const cost = potionCost(pot.cost);
  if (cost > 0) {
    if (S.silver < cost) { P.potCd = 1; warnPotionNoSilver(); return; } 
    addSilver(-cost, 'potion', pot.name.fr);
    floatTxt(P.x,P.y,80,'-'+fmt(cost)+'🪙',{hurt:true});
  }
  P.potCd = pot.cd;
  P.hp = Math.min(effHpMax(), P.hp + effHpMax()*pot.heal);
  floatTxt(P.x,P.y,90,'+PV',{green:true});
}

function usePotionMana() {
  const cost = potionCost(MANA_POTION.cost);
  if (S.silver < cost) { P.manaPotCd = 1; warnPotionNoSilver(); return; } 
  addSilver(-cost, 'potion', MANA_POTION.name.fr);
  floatTxt(P.x,P.y,80,'-'+fmt(cost)+'🪙',{hurt:true});
  P.manaPotCd = MANA_POTION.cd;
  P.mp = Math.min(effManaMax(), P.mp + effManaMax()*MANA_POTION.restore);
  floatTxt(P.x,P.y,90,'+MP',{blue:true});
}

function renderPotSelect() {
  const el = $('potSelect'); if (!el) return;
  const threshPct = Math.round((S.potionThreshold ?? 0.5) * 100);
  const threshRow = `<div id="potThreshRow"><span>${LANG==='fr'?'Boire sous':'Drink under'}</span>` +
    `<input type="range" id="potThreshSlider" min="5" max="95" step="5" value="${threshPct}">` +
    `<span id="potThreshVal">${threshPct}%</span></div>`;
  const rows = POTION_ORDER.map(key => {
    const p = POTIONS[key];
    const healHp = Math.round(effHpMax()*p.heal);
    if (p.locked) {
      return `<div class="psRow locked" title="${LANG==='fr'?'Bientôt disponible':'Coming soon'}">` +
        `<span class="psIcon">🔒</span>` +
        `<span class="psInfo"><span class="psName">${p.name[LANG]}</span><br><span class="psHeal">+${Math.round(p.heal*100)}% PV · CD ${p.cd}s</span></span>` +
        `<span class="psCost">${LANG==='fr'?'Gratuite':'Free'}</span></div>`;
    }
    return `<div class="psRow${S.potionType===key?' sel':''}" data-pot="${key}">` +
      `<span class="psIcon">${p.icon}</span>` +
      `<span class="psInfo"><span class="psName">${p.name[LANG]}</span><br><span class="psHeal">+${fmt(healHp)} PV (${Math.round(p.heal*100)}%) · CD ${p.cd}s</span></span>` +
      `<span class="psCost">${fmt(potionCost(p.cost))} 🪙</span></div>`;
  }).join('');
  
  const manaSection = `<div class="psSectionLabel">${LANG==='fr'?'Potion de vie':'HP Potion'}</div>` +
    rows +
    `<div class="psSectionLabel">${LANG==='fr'?'Potion de mana (auto sous 30%)':'Mana Potion (auto under 30%)'}</div>` +
    `<div class="psRow psRowInfo">` +
      `<span class="psIcon">🔷</span>` +
      `<span class="psInfo"><span class="psName">${MANA_POTION.name[LANG]}</span><br><span class="psHeal">+${Math.round(MANA_POTION.restore*100)}% MP · CD ${MANA_POTION.cd}s</span></span>` +
      `<span class="psCost">${fmt(potionCost(MANA_POTION.cost))} 🪙</span></div>`;
  el.innerHTML = threshRow + manaSection;
  
  el.querySelectorAll('.psRow:not(.locked):not(.psRowInfo)').forEach(row => {
    row.onclick = e => { e.stopPropagation(); S.potionType = row.dataset.pot; el.classList.remove('show'); };
  });
  const slider = $('potThreshSlider');
  slider.oninput = e => { e.stopPropagation(); S.potionThreshold = Number(slider.value)/100; $('potThreshVal').textContent = slider.value+'%'; };
  slider.onclick = e => e.stopPropagation();
}
function togglePotSelect(e) {
  e.stopPropagation();
  const el = $('potSelect');
  const willShow = !el.classList.contains('show');
  if (willShow) renderPotSelect();
  el.classList.toggle('show', willShow);
}

// ==== src/combat/boss.js ====
const BOSS_ROSTER = {
  kzarka: {
    name:{fr:'Grand Seigneur de guerre de la corruption',en:'Great Warlord of Corruption'},
    short:{fr:'Seigneur de guerre',en:'Warlord'}, icon:'👹', color:'#7a2d33',
    hp: 400000,          
    reward: 250000,      
    matKey:'mat_Pierre noire', matName:'Pierre noire', matIcon:ICO_MAT_NOIRE, matQty:[8,20],
    
    rareLoot: { name:'Pierre de sang de Kzarka', icon:'🩸', color:'#c0524a', ch:0.01 },
  },
  
  vell: {
    name:{fr:'Vell, la Terreur des Flots',en:'Vell, Terror of the Tides'},
    short:{fr:'Vell',en:'Vell'}, icon:'🐋', color:'#2a5a78',
    hp: 550000,
    reward: 400000,
    matKey:'mat_Pierre noire', matName:'Pierre noire', matIcon:ICO_MAT_NOIRE, matQty:[12,28],
    
    rareLoot: { name:'Coeur de Vell', icon:ICO_COEUR_VELL, color:'#5ec9e8', ch:0.05 },
  },
};

const KZARKA_REWARD_TIERS = {
  1: { caphras:[50,100], frag:[20,30], silver:1000000 },
  2: { caphras:[35,75],  frag:[15,25], silver:100000 },
  3: { caphras:[15,50],  frag:[10,20], silver:10000 },
};

const BOSS_SCHEDULE = [
  { boss:'kzarka', day:'daily', h:12, m:45 },
  { boss:'kzarka', day:'daily', h:19, m:45 },
  { boss:'kzarka', day:'daily', h:23, m:45 },
  { boss:'kzarka', day:0,       h:15, m:45 },
  { boss:'kzarka', day:6,       h:15, m:45 },
  { boss:'vell',   day:4,       h:12, m:0  },
  { boss:'vell',   day:0,       h:16, m:45 },
];
const BOSS_WINDOW_MS = 9 * 60 * 1000; 

function parisOffsetMinutes(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:'Europe/Paris',
    hour12:false, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit'
  }).formatToParts(date).map(p => [p.type, p.value]));
  const asUTC = Date.UTC(+parts.year, +parts.month-1, +parts.day, parts.hour==='24'?0:+parts.hour, +parts.minute, +parts.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

function bossOccurrences(fromDate) {
  const now = fromDate.getTime();
  const offsetMin = parisOffsetMinutes(fromDate);
  const parisParts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone:'Europe/Paris',
    year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(fromDate).map(p => [p.type, p.value]));
  const baseY = +parisParts.year, baseM = +parisParts.month-1, baseD = +parisParts.day;
  const list = [];
  for (const entry of BOSS_SCHEDULE) {
    for (let d = -1; d <= 7; d++) {
      const dow = new Date(Date.UTC(baseY, baseM, baseD+d)).getUTCDay(); 
      if (entry.day !== 'daily' && dow !== entry.day) continue;
      const t = Date.UTC(baseY, baseM, baseD+d, entry.h, entry.m, 0, 0) - offsetMin*60000;
      if (t + BOSS_WINDOW_MS < now) continue; 
      list.push({ boss:entry.boss, time:t, live: t <= now && now < t + BOSS_WINDOW_MS });
    }
  }
  return list.sort((a,b) => a.time - b.time);
}

let liveBoss = null; 
async function refreshLiveBoss() {
  if (!sb) return;
  const wasLive = !!(liveBoss && liveBoss.expires > Date.now());
  try {
    
    let data = null;
    try {
      const r = await sb.rpc('ensure_scheduled_boss');
      data = Array.isArray(r.data) ? r.data[0] : r.data;
    } catch (e) {}
    if (!data) {
      const r = await sb.from('live_boss').select('boss_id, spawned_at, expires_at, hp, max_hp').eq('id', 1).maybeSingle();
      data = r.data;
    }
    if (data && data.boss_id && BOSS_ROSTER[data.boss_id] && new Date(data.expires_at).getTime() > Date.now()) {
      liveBoss = { boss: data.boss_id, time: new Date(data.spawned_at).getTime(), expires: new Date(data.expires_at).getTime(),
                   hp: Number(data.hp||0), maxHp: Number(data.max_hp||0) };
    } else liveBoss = null;
  } catch (e) {}
  updateNextBossMini();
  
  const nowLive = !!(liveBoss && liveBoss.expires > Date.now());
  const room = $('bossRoom');
  if (nowLive !== wasLive && room && room.classList.contains('open') && room.classList.contains('lobby') && !bossState.active) {
    $('bossLobbyBody').innerHTML = renderBossLobbyHtml();
    wireBossLobby();
  }
}
function nextBossOccurrence() {
  
  if (liveBoss && liveBoss.expires > Date.now()) return { boss: liveBoss.boss, time: liveBoss.time, live: true, sharedHp: true, hp: liveBoss.hp, maxHp: liveBoss.maxHp };
  const occ = bossOccurrences(new Date());
  return occ.find(o => o.live) || occ[0] || null;
}
function fmtBossCountdown(ms) {
  let s = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(s/3600); s -= h*3600;
  const m = Math.floor(s/60); s -= m*60;
  const pad = n => String(n).padStart(2,'0');
  return (h>0 ? pad(h)+':' : '') + pad(m)+':'+pad(s);
}

function updateNextBossMini() {
  const el = $('nextBossMini'); if (!el) return;
  const occ = nextBossOccurrence();
  if (!occ) { el.innerHTML = ''; return; }
  const b = BOSS_ROSTER[occ.boss];
  if (occ.live) {
    el.innerHTML = `<span class="live">${b.icon} ${b.short[LANG]} ${LANG==='fr'?'EN COURS':'LIVE'}</span>`;
  } else {
    el.innerHTML = `${LANG==='fr'?'Prochain boss':'Next boss'} : <b>${b.icon} ${b.short[LANG]}</b> ${LANG==='fr'?'dans':'in'} <b>${fmtBossCountdown(occ.time - Date.now())}</b>`;
  }
}

const ACTIVITY_TABS = [
  { id:'zone', icon:'⚔️', name:{fr:'Zone',en:'Zone'},       locked:false },
  { id:'boss', icon:'🐍', name:{fr:'Boss',en:'Boss'},       locked:false },
  { id:'fish', icon:'🎣', name:{fr:'Pêche',en:'Fishing'},   locked:true },
  { id:'mine', icon:'⛏️', name:{fr:'Mine',en:'Mining'},     locked:true },
  { id:'forest', icon:'🌲', name:{fr:'Forêt',en:'Forest'},  locked:true },
  { id:'field', icon:'🌾', name:{fr:'Champs',en:'Fields'},  locked:true },
  { id:'ranch', icon:'🐑', name:{fr:'Bergerie',en:'Ranch'}, locked:true },
  { id:'workshop', icon:'🏛️', name:{fr:'Atelier royal',en:'Royal Workshop'}, locked:true },
  { id:'pet', icon:'🐾', name:{fr:'Compagnon',en:'Companion'}, locked:true },
  { id:'sea', icon:'🌊', name:{fr:'Vie en mer',en:'Sea life'}, locked:true },
];
let currentActivity = 'zone';

function renderActivityTabs() {
  const el = $('activityTabs'); if (!el) return;
  el.innerHTML = ACTIVITY_TABS.map(t => {
    
    const hpBadge = t.id === 'boss' ? '<span class="actTabBossHp" id="actTabBossHp"></span>' : '';
    return `<button class="actTab${t.locked?' locked':''}${t.id===currentActivity?' active':''}" id="${t.id==='boss'?'actTabBoss':''}" data-id="${t.id}"${t.locked?' disabled':''}>` +
      `<span class="actTabLabel">${t.icon} ${t.name[LANG]}</span>${hpBadge}${t.locked?'<span class="actTabLock">🔒</span>':''}</button>`;
  }).join('');
  el.querySelectorAll('.actTab').forEach(btn => {
    if (btn.classList.contains('locked')) return;
    btn.onclick = () => showActivityPage(btn.dataset.id);
  });
  updateBossActivityTabHot();
}

const BOSS_TAB_FLASH_LEAD_MS = 5 * 60 * 1000;
function updateBossActivityTabHot() {
  const btn = $a('actTabBoss'); if (!btn) return;
  const occ = nextBossOccurrence();
  
  const fighting = bossState.active && bossState.maxHp > 0;
  const hot = fighting || (!!occ && (occ.live || (occ.time - Date.now()) <= BOSS_TAB_FLASH_LEAD_MS));
  btn.classList.toggle('bossHot', hot);
  const hpEl = $a('actTabBossHp');
  if (hpEl) {
    if (fighting) hpEl.textContent = Math.max(0, bossState.hp/bossState.maxHp*100).toFixed(0)+'%';
    else if (occ && occ.live && typeof occ.hp === 'number' && occ.maxHp > 0) hpEl.textContent = Math.max(0, occ.hp/occ.maxHp*100).toFixed(0)+'%';
    else hpEl.textContent = '';
  }
}
setInterval(updateBossActivityTabHot, 1000);

function setFarmViewVisible(v) {
  ['gameFrame','panel','itemPop','itemTooltip'].forEach(id => {
    const el = $(id); if (el) el.style.display = v ? '' : 'none';
  });
}
function showActivityPage(id) {
  if (id === 'boss') {
    currentActivity = 'boss';
    setFarmViewVisible(false);
    if (!bossState.active) openBossLobby();
  } else { 
    currentActivity = 'zone';
    if (!bossState.active) $('bossRoom').classList.remove('open');
    setFarmViewVisible(true);
  }
  renderActivityTabs();
}

async function openBossLobby() {
  $('bossRoom').classList.remove('fight'); $('bossRoom').classList.add('lobby', 'open');
  
  await refreshLiveBoss();
  $('bossLobbyBody').innerHTML = renderBossLobbyHtml();
  wireBossLobby();
}

function tickBossPanelCountdown() {
  const el = $a('bossPanelCountdown'); if (!el) return;
  const occ = nextBossOccurrence();
  if (!occ || occ.live) return; 
  el.textContent = fmtBossCountdown(occ.time - Date.now());
}
setInterval(tickBossPanelCountdown, 1000);
setInterval(() => {
  const room = $a('bossRoom');
  if (room && room.classList.contains('open') && room.classList.contains('lobby') && !bossState.active) refreshLiveBoss();
}, 20000);
function renderBossLobbyHtml() {
  const occ = nextBossOccurrence();
  const now = Date.now();
  let nextHtml = `<div class="admEmpty">${LANG==='fr'?'Aucun boss programmé':'No boss scheduled'}</div>`;
  if (occ) {
    const b = BOSS_ROSTER[occ.boss];
    
    const alreadyDead = occ.live && occ.sharedHp && typeof occ.hp === 'number' && occ.hp <= 0;
    const cd = occ.live
      ? `<div class="bossNextCountdown live">${alreadyDead ? (LANG==='fr'?'VAINCU':'DEFEATED') : (LANG==='fr'?'EN COURS':'LIVE')}</div>`
      : `<div class="bossNextCountdown" id="bossPanelCountdown">${fmtBossCountdown(occ.time - now)}</div>`;
    const when = new Date(occ.time).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { weekday:'long', hour:'2-digit', minute:'2-digit' });
    nextHtml = `<div class="bossNext">
      <div class="bossNextIcon">${b.icon}</div>
      <div class="bossNextInfo">
        <div class="bossNextName">${b.name[LANG]}</div>
        <div class="bossNextTime">${alreadyDead ? (LANG==='fr'?'Déjà vaincu par d\'autres joueurs':'Already defeated by other players') : occ.live ? (LANG==='fr'?'Disponible maintenant !':'Available now!') : when}</div>
      </div>
      ${cd}
    </div>` +
    (alreadyDead
      ? `<div class="admHint">${LANG==='fr'?'Ce boss a déjà été vaincu — reviens plus tard, au prochain spawn.':'This boss has already been defeated — come back later, at the next spawn.'}</div>` +
        `<button class="bossFightBtn" id="bossFightBtn" disabled>${LANG==='fr'?'💀 Déjà vaincu':'💀 Already defeated'}</button>`
      : `<button class="bossFightBtn" id="bossFightBtn" ${occ.live?'':'disabled'}>${occ.live?(LANG==='fr'?'⚔️ Combattre':'⚔️ Fight'):(LANG==='fr'?'⏳ Pas encore apparu':'⏳ Not spawned yet')}</button>`);
  }
  
  const weekOcc = bossOccurrences(new Date()).filter(o => o.time < now + 7*24*3600*1000);
  const dayKey = d => d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate();
  const todayKey = dayKey(new Date());
  
  const days = [];
  for (let i=0;i<7;i++){ const d=new Date(); d.setDate(d.getDate()+i); d.setHours(0,0,0,0); days.push(d); }
  
  const timeSet = new Set();
  weekOcc.forEach(o => { const d=new Date(o.time); timeSet.add(String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')); });
  const times = [...timeSet].sort();
  const cellMap = new Map();
  weekOcc.forEach(o => { const d=new Date(o.time); cellMap.set(dayKey(d)+'@'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'), o); });
  let calHtml;
  if (!times.length) {
    calHtml = `<div class="admEmpty">${LANG==='fr'?'Rien de programmé':'Nothing scheduled'}</div>`;
  } else {
    calHtml = `<div class="bossCal" style="grid-template-columns:44px repeat(7,1fr)">`;
    calHtml += `<div class="bcCorner"></div>`;
    days.forEach(d => { const today = dayKey(d)===todayKey;
      calHtml += `<div class="bcHead${today?' bcToday':''}">${d.toLocaleDateString(LANG==='fr'?'fr-FR':'en-US',{weekday:'short'})}<span class="bcDate">${d.getDate()}/${d.getMonth()+1}</span></div>`; });
    times.forEach(tm => {
      calHtml += `<div class="bcTime">${tm}</div>`;
      days.forEach(d => {
        const o = cellMap.get(dayKey(d)+'@'+tm);
        if (o) { const b=BOSS_ROSTER[o.boss];
          calHtml += `<div class="bcCell${o.live?' bcLive':''}" title="${b.name[LANG]}">${b.icon}<span class="bcName">${o.live?(LANG==='fr'?'EN COURS':'LIVE'):b.short[LANG]}</span></div>`; }
        else calHtml += `<div class="bcCell bcEmpty"></div>`;
      });
    });
    calHtml += `</div>`;
  }
  
  const legend = Object.values(BOSS_ROSTER).map(b => `<span class="bcLegend">${b.icon} ${b.name[LANG]}</span>`).join('');
  
  return `${nextHtml}
    <h3>${LANG==='fr'?'📅 Calendrier de la semaine':'📅 Weekly calendar'}</h3>
    ${calHtml}
    <div class="bcLegendRow">${legend}</div>
    <div class="admSummary">${LANG==='fr'?'Horaires calqués sur le vrai BDO −15 min. Heure locale.':'Times mirror real BDO −15 min. Local time.'}</div>
    ${bossRewardRulesHtml()}`;
}
function wireBossLobby() {
  const btn = $a('bossFightBtn');
  const occ = nextBossOccurrence();
  if (btn && !btn.disabled && occ) btn.onclick = () => startBossFight(occ.boss, !!occ.sharedHp);
  
  document.querySelectorAll('.bossRewardSelSeg').forEach(seg => {
    seg.onclick = () => {
      bossRewardPreviewBoss = seg.dataset.boss;
      $('bossLobbyBody').innerHTML = renderBossLobbyHtml();
      wireBossLobby();
    };
  });
}

const bossState = { active:false, boss:null, hp:0, maxHp:0, duration:0, elapsed:0, playerHp:0, playerHpMax:0, hits:[], last:0, raf:0, potCd:0, ended:false,
  px:0.5, py:0.85, pillars:[], aoePhase:'idle', aoeT:0, aoeInterval:9, blocked:false, blockFlash:0, hurtFlash:0, floatMsgs:[],
  
  shared:false, expiresAt:0, contribAccum:0, contribCd:0, topCd:0, topList:[], myDmg:0, activeFighters:0, presenceCd:0,
  
  shakeT:0, embers:[] };

let bossChannel = null;
let otherFighters = {}; 
let otherFightersPos = {}; 

function joinBossChannel(bossKey) {
  leaveBossChannel();
  if (!sb || !currentUser) { console.debug('[BossPresence] abandon (pas de sb ou pas connecté)'); return; }
  const myUid = currentUser.id;
  const topic = 'boss_'+bossKey;
  console.debug('[BossPresence] join', { topic, myUid });
  const ch = sb.channel(topic, { config: { presence: { key: myUid } } });
  bossChannel = ch;
  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState();
    console.debug('[BossPresence] sync', { topic, keys: Object.keys(state) });
    const next = {};
    for (const uid in state) {
      if (uid === myUid) continue;
      const entry = state[uid] && state[uid][0];
      if (entry) next[uid] = entry;
    }
    otherFighters = next;
  });
  ch.subscribe(status => {
    console.debug('[BossPresence] status', { topic, status });
    if (status === 'SUBSCRIBED') { ch.track({ pseudo: myPseudo || 'Joueur', px: bossState.px, py: bossState.py }); return; }
    
    if ((status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && bossChannel === ch) {
      console.debug('[BossPresence] reconnexion programmée', { topic, status });
      setTimeout(() => { if (bossChannel === ch && bossState.active && bossState.shared) joinBossChannel(bossKey); }, 1500);
    }
  });
}
function leaveBossChannel() {
  if (bossChannel) console.debug('[BossPresence] leave', { topic: bossChannel.topic });
  if (bossChannel && sb) { try { sb.removeChannel(bossChannel); } catch(e) {} }
  bossChannel = null;
  otherFighters = {};
  otherFightersPos = {};
}

const BOSS_PILLARS = [{x:.28,y:.44},{x:.72,y:.44},{x:.28,y:.72},{x:.72,y:.72}];

const BOSS_SPOTS_KZARKA = [
  {x:.18,y:.58},{x:.50,y:.52},{x:.82,y:.58},
  {x:.28,y:.66},{x:.72,y:.66},
  {x:.14,y:.76},{x:.38,y:.80},{x:.50,y:.84},{x:.62,y:.80},{x:.86,y:.76},
];

const BOSS_SPOTS_VELL = [
  {x:.06,y:.86},{x:.11,y:.89},{x:.16,y:.92},{x:.09,y:.95},{x:.14,y:.97},
  {x:.94,y:.86},{x:.89,y:.89},{x:.84,y:.92},{x:.91,y:.95},{x:.86,y:.97},
];
function bossAttackSpots(bossId) { return bossId === 'vell' ? BOSS_SPOTS_VELL : BOSS_SPOTS_KZARKA; }
const bossCtx = document.getElementById('bossCv').getContext('2d');

let _skillDpsSum = 0;

const BOSS_REF_DPS = 1333;
function playerBossDps() {
  if (!_skillDpsSum) _skillDpsSum = SKILLS.filter(s => s.dmg).reduce((a,s) => a + s.dmg/s.cd, 0);
  return Math.max(1, apEff() * _skillDpsSum);
}
function startBossFight(bossId, isShared) {
  const b = BOSS_ROSTER[bossId];
  
  const shared = !!isShared && liveBoss && liveBoss.expires > Date.now();
  const hp = shared ? liveBoss.hp : b.hp;
  const maxHp = shared ? liveBoss.maxHp : b.hp;
  const rawDur = b.hp / playerBossDps();           
  const duration = Math.max(120, Math.min(420, rawDur)); 
  
  const spots = bossId === 'vell' ? VELL_ANCHORS : BOSS_PILLARS;
  
  const atkSpots = bossAttackSpots(bossId);
  const atkPos = { ...atkSpots[Math.floor(Math.random()*atkSpots.length)] };
  Object.assign(bossState, {
    active:true, ended:false, boss:b, bossId, hp, maxHp, duration, elapsed:0,
    playerHp: effHpMax(), playerHpMax: effHpMax(), hits:[], last:performance.now(), potCd:0,
    px:atkPos.x, py:atkPos.y, atkPos, pillars:spots.map(p=>({...p})), aoePhase:'idle', aoeT:0, aoeInterval:8,
    blocked:false, blockFlash:0, hurtFlash:0, floatMsgs:[],
    shared, expiresAt: shared ? liveBoss.expires : 0, contribAccum:0, contribCd:0, topCd:0, topList:[], myDmg:0, activeFighters:0,
    shakeT:0, embers:[],
  });
  currentActivity = 'boss'; renderActivityTabs();
  setFarmViewVisible(false);
  $('bossRoom').classList.remove('lobby'); $('bossRoom').classList.add('open', 'fight');
  $('bossResult').classList.remove('show');
  $('bossName').textContent = b.name[LANG] + (shared ? ' 🌐' : '');
  $('bossTopPanel').classList.toggle('show', shared);
  if (shared) { refreshBossTop(); joinBossChannel(liveBoss.time); } else { leaveBossChannel(); }
  resizeBossCanvas();
  bossState.raf = requestAnimationFrame(bossLoop);
}

async function refreshBossTop() {
  if (!sb || !bossState.shared) return;
  try {
    const [{ data }, { data: activeCount }] = await Promise.all([
      sb.rpc('boss_top'), sb.rpc('boss_active_count'),
    ]);
    bossState.topList = data || [];
    bossState.activeFighters = typeof activeCount === 'number' ? activeCount : 0;
    renderBossTop();
  } catch (e) {}
}
function renderBossTop() {
  const el = $('bossTopList'); if (!el) return;
  const liveEl = $('btpLiveCount');
  if (liveEl) {
    const n = bossState.activeFighters || 0;
    liveEl.textContent = n > 0
      ? (LANG==='fr' ? `${n} joueur${n>1?'s':''} combattent` : `${n} player${n>1?'s':''} fighting`)
      : (LANG==='fr' ? 'En attente de combattants' : 'Waiting for fighters');
  }
  const list = bossState.topList.slice(0, 10);
  if (!list.length) { el.innerHTML = `<div class="btpRow">${LANG==='fr'?'Sois le premier !':'Be the first!'}</div>`; return; }
  el.innerHTML = list.map((r,i) =>
    `<div class="btpRow${currentUser && r.user_id===currentUser.id?' me':''}"><span class="btpRank">#${i+1}</span>` +
    `<span class="btpPseudo">${r.active?'<span class="btpActiveDot"></span>':''}${escapeHtml(r.pseudo||'?')}</span>` +
    `<span class="btpPct">${(r.pct!=null?r.pct:0)}%</span><span class="btpDmg">${fmt(Math.round(r.damage))}</span></div>`).join('');
}
function resizeBossCanvas() {
  const cv = $('bossCv');
  cv.width = cv.clientWidth || 1280;
  cv.height = cv.clientHeight || 600;
}

function bossRankMultiplier(rank) {
  if (rank === 1) return 3;
  if (rank <= 3) return 2;
  if (rank <= 10) return 1.4;
  return 1; 
}

function bestDifficileZoneIdx() {
  let best = -1;
  for (let zi = 0; zi < ZONES.length; zi++) {
    if (badgeOf(bottleneck(ZONES[zi])).txt === 'ZONE DIFFICILE' && (best === -1 || ZONES[zi].reqAP > ZONES[best].reqAP)) best = zi;
  }
  return best === -1 ? null : best;
}

function nextDangereuseZoneIdx() {
  let best = -1;
  for (let zi = 0; zi < ZONES.length; zi++) {
    if (badgeOf(bottleneck(ZONES[zi])).txt === 'ZONE DANGEREUSE' && (best === -1 || ZONES[zi].reqAP < ZONES[best].reqAP)) best = zi;
  }
  return best === -1 ? null : best;
}
function bossZoneJackpotItem(zi) {
  const z = ZONES[zi], tier = gearTierForZone(zi);
  const jSlot = accSlotFor(z.loot.jackpot);
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const icon = (JEWEL_ICON_FOR_SLOT[jSlot] || ringIconForTier)(jTierIdx, tier.color);
  const ap = gearFloor((z.gearBasisAP ?? z.reqAP) * GEAR_ROLE.jackpot.apShare);
  const val = gearFloor(z.loot.trash.val * JACKPOT_VAL_TRASH_RATIO);
  return { ...z.loot.jackpot, ap, val, kind:'jackpot', color:tier.color, key:'acc_boss_'+zi+'_'+Math.random().toString(36).slice(2,7), icon, stackable:false, weight:0.5, matName:tier.material.name };
}
function bossZoneMaterialItem(zi, qty) {
  const tier = gearTierForZone(zi), z = ZONES[zi];
  return { name:tier.material.name, kind:'material', icon:tier.material.icon, color:tier.material.color, key:'mat_'+tier.material.name, qty, stackable:true, weight:0.1, val:z.loot.mat.val };
}

let bossRewardPreviewBoss = 'kzarka';
function bossRewardSelectorHtml() {
  return `<div class="bossRewardSel">` + Object.keys(BOSS_ROSTER).map(k => {
    const b = BOSS_ROSTER[k], active = bossRewardPreviewBoss === k;
    return `<div class="bossRewardSelSeg${active?' active':''}" data-boss="${k}">${b.icon} ${b.short[LANG]}</div>`;
  }).join('') + `</div>`;
}

function bossRewardRulesHtml() {
  const b = BOSS_ROSTER[bossRewardPreviewBoss];
  const rareLine = b.rareLoot
    ? `<div class="bossRewardExtra">✨ +${Math.round(b.rareLoot.ch*100)}% ${LANG==='fr'?'de chance':'chance'} : <b style="color:${b.rareLoot.color}">${b.rareLoot.name}</b></div>`
    : '';
  
  let baseHtml, podiumHtml;
  if (bossRewardPreviewBoss === 'kzarka') {
    const t1 = KZARKA_REWARD_TIERS[1], t2 = KZARKA_REWARD_TIERS[2], t3 = KZARKA_REWARD_TIERS[3];
    baseHtml = '';
    podiumHtml = `<div class="bossPodium">
      <div class="bossPodiumStep rank2"><div class="bossPodiumMedal">🥈</div><div class="bossPodiumReward">+${fmt(t2.silver)} 🪙<br>${t2.caphras[0]}-${t2.caphras[1]} ${LANG==='fr'?'Caphras':'Caphras'} · ${t2.frag[0]}-${t2.frag[1]} ${LANG==='fr'?'Frag. mémoire':'Memory frag.'}</div></div>
      <div class="bossPodiumStep rank1"><div class="bossPodiumMedal">🥇</div><div class="bossPodiumReward">+${fmt(t1.silver)} 🪙<br>${t1.caphras[0]}-${t1.caphras[1]} ${LANG==='fr'?'Caphras':'Caphras'} · ${t1.frag[0]}-${t1.frag[1]} ${LANG==='fr'?'Frag. mémoire':'Memory frag.'}</div></div>
      <div class="bossPodiumStep rank3"><div class="bossPodiumMedal">🥉</div><div class="bossPodiumReward">+${fmt(t3.silver)} 🪙<br>${t3.caphras[0]}-${t3.caphras[1]} ${LANG==='fr'?'Caphras':'Caphras'} · ${t3.frag[0]}-${t3.frag[1]} ${LANG==='fr'?'Frag. mémoire':'Memory frag.'}</div></div>
    </div>`;
  } else {
    const dZi = bestDifficileZoneIdx(), dgZi = nextDangereuseZoneIdx();
    const dName = dZi != null ? tr(ZONES[dZi].name) : '—';
    const dgName = dgZi != null ? tr(ZONES[dgZi].name) : '—';
    baseHtml = `<div class="bossRewardBase">🎁 ${LANG==='fr'?'Pour tous':'For everyone'} : ${LANG==='fr'?"pierre d'optimisation de ta meilleure zone difficile":'enhancement stone from your best hard zone'} (<b>${dName}</b>)</div>`;
    podiumHtml = `<div class="bossPodium">
      <div class="bossPodiumStep rank2"><div class="bossPodiumMedal">🥈</div><div class="bossPodiumReward">${LANG==='fr'?'+1 bijou de ta zone difficile':'+1 jewel from your hard zone'} (<b>${dName}</b>)</div></div>
      <div class="bossPodiumStep rank1"><div class="bossPodiumMedal">🥇</div><div class="bossPodiumReward">${LANG==='fr'?'+1 bijou de la prochaine zone dangereuse':'+1 jewel from the next dangerous zone'} (<b>${dgName}</b>)</div></div>
      <div class="bossPodiumStep rank3"><div class="bossPodiumMedal">🥉</div><div class="bossPodiumReward">${LANG==='fr'?'20% bijou dangereuse + 30% bijou difficile':'20% dangerous jewel + 30% hard jewel'}</div></div>
    </div>`;
  }
  return `<div class="bossRewardRules">
    ${bossRewardSelectorHtml()}
    ${baseHtml}
    ${podiumHtml}
    ${rareLine}
  </div>`;
}

function renderBossRewardWheel(rareLoot, won) {
  const N = 12; 
  const segDeg = 360/N;
  
  const commonIcon = '⚫';
  let iconsHtml = '';
  for (let i = 0; i < N; i++) {
    const centerDeg = i*segDeg + segDeg/2;
    const isRare = i === 0;
    iconsHtml += `<span class="bwIcon" style="transform:rotate(${centerDeg}deg) translate(0,-70px) rotate(${-centerDeg}deg)">${isRare?rareLoot.icon:commonIcon}</span>`;
  }
  const wheelHtml = `<div class="bossWheelWrap"><div class="bossWheelPointer">▼</div>` +
    `<div class="bossWheel" id="bossWheelEl" style="background:conic-gradient(${rareLoot.color} 0deg ${segDeg}deg, #232128 ${segDeg}deg 360deg)">${iconsHtml}</div></div>` +
    `<div class="bossWheelResult" id="bossWheelResultEl">${LANG==='fr'?'🎡 Récompense rare...':'🎡 Rare reward...'}</div>`;
  
  setTimeout(() => {
    const wheel = $a('bossWheelEl'); if (!wheel) return;
    const spins = 5;
    
    const targetDeg = won ? segDeg/2 : (60 + Math.random()*270);
    const finalRotation = spins*360 - targetDeg;
    wheel.style.transform = `rotate(${finalRotation}deg)`;
    setTimeout(() => {
      const res = $a('bossWheelResultEl'); if (!res) return;
      res.innerHTML = won
        ? `<span style="color:${rareLoot.color}">${rareLoot.icon} ${LANG==='fr'?'Obtenu' : 'Obtained'} : ${rareLoot.name} !</span>`
        : (LANG==='fr' ? `Pas cette fois — ${rareLoot.icon} ${rareLoot.name} attend toujours` : `Not this time — ${rareLoot.icon} ${rareLoot.name} still awaits`);
    }, 3600);
  }, 50);
  return wheelHtml;
}
async function endBossFight(win) {
  if (bossState.ended) return;
  bossState.ended = true;
  bossState.active = false;
  cancelAnimationFrame(bossState.raf);
  leaveBossChannel();
  const b = bossState.boss;
  let rewardsHtml = '';
  let wheelHtml = '';
  
  let alreadyClaimed = false;
  if (win) {
    let mult = 1, rank = null;
    if (bossState.shared && sb) {
      try {
        
        if (bossState.contribAccum > 0) {
          const dmg = bossState.contribAccum; bossState.contribAccum = 0;
          try { await sb.rpc('boss_contribute', { p_damage: dmg, p_pseudo: myPseudo || null }); } catch (e) {}
        }
        const { data } = await sb.rpc('boss_claim');
        if (typeof data === 'number' && data > 0) { rank = data; mult = bossRankMultiplier(rank); }
        
        else alreadyClaimed = true;
      } catch (e) { alreadyClaimed = true; } 
    }
    if (alreadyClaimed) {
      rewardsHtml = `<div class="brRewards admHint">${LANG==='fr'
        ? 'Récompense déjà réclamée pour ce boss — chaque victoire ne peut être payée qu\'une seule fois.'
        : 'Reward already claimed for this boss — each victory can only be paid out once.'}</div>`;
    } else {
      
      if (!bossState.shared) rank = 1;
      let reward;
      
      if (bossState.bossId === 'kzarka' && rank) {
        const tier = KZARKA_REWARD_TIERS[Math.min(rank, 3)];
        const caphrasQty = Math.round(tier.caphras[0] + Math.random()*(tier.caphras[1]-tier.caphras[0]));
        const fragQty = Math.round(tier.frag[0] + Math.random()*(tier.frag[1]-tier.frag[0]));
        reward = tier.silver;
        addSilver(reward, 'boss', b.name.fr);
        invAdd({ key:'mat_'+CAPHRAS_NAME, name:CAPHRAS_NAME, kind:'material', icon:ICO_MAT_CAPHRAS, color:'#c9a55a', qty:caphrasQty, stackable:true, weight:0.1, val:120 });
        invAdd({ name:'Fragment de mémoire', kind:'craft', icon:'✦', color:'#b48ce8', key:'craft_Fragment de mémoire', qty:fragQty, stackable:true, weight:0.2, val:0 });
        const rankHtml = `<div class="brRewards">${LANG==='fr'?'Rang de contribution':'Contribution rank'} : <b>#${rank}</b></div>`;
        rewardsHtml = rankHtml + `<div class="brRewards">+${fmt(reward)} 🪙<br>+${caphrasQty} × ${tr(CAPHRAS_NAME)}<br>+${fragQty} × ${tr('Fragment de mémoire')}</div>`;
      } else {
        
        const deathFreeMs = Date.now() - (S.lastDeathAt || 0);
        const deathFreeOk = deathFreeMs >= 3*60*1000;
        const zoneMult = deathFreeOk ? 1 + (S.maxZoneIdx/(ZONES.length-1))*1.5 : 1;
        reward = Math.round(b.reward * mult * zoneMult);
        addSilver(reward, 'boss', b.name.fr);
        
        const difficileZi = bestDifficileZoneIdx(), dangereuseZi = nextDangereuseZoneIdx();
        const zoneRewardLines = [];
        if (difficileZi != null) {
          const qty = Math.max(1, Math.round((3 + Math.random()*5) * mult * zoneMult));
          const matItem = bossZoneMaterialItem(difficileZi, qty);
          invAdd(matItem);
          zoneRewardLines.push(`+${qty} × ${tr(matItem.name)} <span class="admHint">(${tr(ZONES[difficileZi].name)})</span>`);
        }
        const jewelZonesToGrant = [];
        if (rank === 1 && dangereuseZi != null) jewelZonesToGrant.push(dangereuseZi);
        else if (rank === 2 && difficileZi != null) jewelZonesToGrant.push(difficileZi);
        else if (rank === 3) {
          if (dangereuseZi != null && Math.random() < 0.20) jewelZonesToGrant.push(dangereuseZi);
          if (difficileZi != null && Math.random() < 0.30) jewelZonesToGrant.push(difficileZi);
        }
        for (const zi of jewelZonesToGrant) {
          const jItem = bossZoneJackpotItem(zi);
          if (invAdd(jItem)) {
            trackLoot(jItem.name);
            zoneRewardLines.push(`+💎 ${tr(jItem.name)} <span class="admHint">(${tr(ZONES[zi].name)})</span>`);
            logToDiscord('💎 Bijou de World Boss', `**${myPseudo||'Joueur'}** obtient ${jItem.name} (rang #${rank}) sur ${b.name.fr}`, 0xb48ce8);
          }
        }
        const rankHtml = rank ? `<div class="brRewards">${LANG==='fr'?'Rang de contribution':'Contribution rank'} : <b>#${rank}</b></div>` : '';
        const zoneHtml = `<div class="brRewards admHint">${deathFreeOk
          ? (LANG==='fr'?`Bonus de zone (${tr(ZONES[S.maxZoneIdx].name)}) : certifié sans mort ✓ ×${zoneMult.toFixed(2)}`:`Zone bonus (${tr(ZONES[S.maxZoneIdx].name)}): death-free certified ✓ ×${zoneMult.toFixed(2)}`)
          : (LANG==='fr'?'Pas de bonus de zone : mort il y a moins de 3 min':'No zone bonus: died less than 3 min ago')}</div>`;
        rewardsHtml = rankHtml + `<div class="brRewards">+${fmt(reward)} 🪙<br>${zoneRewardLines.join('<br>')}</div>` + zoneHtml;
      }
      pushNotif('🏆', LANG==='fr'?'Boss vaincu':'Boss defeated', b.name[LANG]+' — +'+fmt(reward)+' 🪙', 'success');
      logToDiscord('🏆 Boss vaincu', `**${myPseudo||'Joueur'}** a vaincu ${b.name.fr}${rank?' (rang #'+rank+')':''} — +${fmt(reward)} 🪙`, 0xe8b84a);
      if (bossState.bossId) markBossDefeated(bossState.bossId); 
      
      if (b.rareLoot) {
        const won = Math.random() < b.rareLoot.ch;
        if (won) {
          invAdd({ name:b.rareLoot.name, kind:'craft', icon:b.rareLoot.icon, color:b.rareLoot.color, key:'craft_'+b.rareLoot.name, qty:1, stackable:true, weight:0.3, val:0 });
          trackLoot(b.rareLoot.name);
          logToDiscord('❤️‍🔥 Loot rarissime', `**${myPseudo||'Joueur'}** obtient ${b.rareLoot.name} sur ${b.name.fr} ! (${Math.round(b.rareLoot.ch*100)}% de chance)`, 0x5ec9e8);
        }
        wheelHtml = renderBossRewardWheel(b.rareLoot, won);
      }
      refreshStatsOnly(); hud();
    }
  }
  $('bossResult').innerHTML =
    `<div class="brTitle ${win?'win':''}">${win?(LANG==='fr'?'🏆 VICTOIRE':'🏆 VICTORY'):(LANG==='fr'?'Combat quitté':'Fight left')}</div>` +
    rewardsHtml + wheelHtml +
    `<button id="bossCloseBtn">${LANG==='fr'?'Retour':'Back'}</button>`;
  $('bossResult').classList.add('show');
  
  $a('bossCloseBtn').onclick = () => { $('bossResult').classList.remove('show'); openBossLobby(); };
}
function bossLoop(now) {
  if (!bossState.active) return;
  const dt = Math.min(.05, (now - bossState.last)/1000); bossState.last = now;
  bossState.elapsed += dt;
  
  const dps = bossState.shared ? playerBossDps() : (bossState.maxHp / bossState.duration);
  bossState.hp = Math.max(0, bossState.hp - dps*dt);
  if (bossState.shared) {
    bossState.contribAccum += dps*dt; bossState.myDmg += dps*dt;
    bossState.contribCd -= dt; bossState.topCd -= dt;
    if (bossState.contribCd <= 0 && bossState.contribAccum > 0) {
      bossState.contribCd = 1.2;
      const dmg = bossState.contribAccum; bossState.contribAccum = 0;
      sb.rpc('boss_contribute', { p_damage: dmg, p_pseudo: myPseudo || null }).then(({ data, error }) => {
        if (error || !data || !data.length) return;
        
        bossState.hp = Number(data[0].hp); bossState.maxHp = Number(data[0].max_hp) || bossState.maxHp;
      }).catch(()=>{});
    }
    if (bossState.topCd <= 0) { bossState.topCd = 4; refreshBossTop(); }
    bossState.presenceCd -= dt;
    if (bossState.presenceCd <= 0 && bossChannel) {
      bossState.presenceCd = 0.35;
      bossChannel.track({ pseudo: myPseudo || 'Joueur', px: bossState.px, py: bossState.py });
    }
    
    for (const uid in otherFighters) {
      const f = otherFighters[uid];
      if (!f || typeof f.px !== 'number' || typeof f.py !== 'number') continue;
      let p = otherFightersPos[uid];
      if (!p) { p = otherFightersPos[uid] = { x:f.px, y:f.py }; } 
      const mdx = f.px-p.x, mdy = f.py-p.y, md = Math.hypot(mdx,mdy);
      if (md > 0.0015) { const spd = 1.1*dt; p.x += mdx/md*Math.min(spd,md); p.y += mdy/md*Math.min(spd,md); }
    }
    for (const uid in otherFightersPos) { if (!otherFighters[uid]) delete otherFightersPos[uid]; } 
  }
  if (Math.random() < dt*4) { 
    const crit = Math.random() < .2;
    bossState.hits.push({ x:.5+(Math.random()-.5)*.3, y:.4+(Math.random()-.5)*.15, life:1, dmg:dps*(crit?1.6:.7), crit });
    if (crit) bossState.shakeT = Math.max(bossState.shakeT, 6); 
  }
  
  bossState.shakeT = Math.max(0, bossState.shakeT - dt*26);
  if (Math.random() < dt*3) {
    bossState.embers.push({ x:Math.random(), y:0.55+Math.random()*0.4, depth:0.25+Math.random()*0.85, life:1, sway:Math.random()*6.28 });
  }
  bossState.embers.forEach(e => { e.y -= dt*0.10*(0.4+e.depth); e.sway += dt*2; e.life -= dt*0.16; });
  bossState.embers = bossState.embers.filter(e => e.life > 0 && e.y > -0.05);
  
  bossState.potCd = Math.max(0, bossState.potCd - dt);
  const incoming = (bossState.playerHpMax * 0.04) * dmgTakenMult(dpRatio()) * dt;
  bossState.playerHp -= incoming;

  bossState.aoeT += dt;
  const bs = bossState, dodging = (bs.aoePhase==='telegraph'||bs.aoePhase==='blast');
  
  let tx, ty;
  if (dodging) {
    let best=bs.pillars[0], bd=1e9;
    for (const p of bs.pillars) { const d=Math.hypot(p.x-bs.px, p.y-bs.py); if(d<bd){bd=d;best=p;} }
    tx = best.x; ty = best.y + 0.07; 
  } else { tx = bs.atkPos.x; ty = bs.atkPos.y; }
  const spd = 0.9*dt, mdx = tx-bs.px, mdy = ty-bs.py, md = Math.hypot(mdx,mdy);
  if (md>0.002) { bs.px += mdx/md*Math.min(spd,md); bs.py += mdy/md*Math.min(spd,md); }
  
  if (bs.aoePhase==='idle' && bs.aoeT >= bs.aoeInterval) { bs.aoePhase='telegraph'; bs.aoeT=0; }
  else if (bs.aoePhase==='telegraph' && bs.aoeT >= 2.2) {
    bs.aoePhase='blast'; bs.aoeT=0;
    
    const safe = bs.pillars.some(p => Math.hypot(p.x-bs.px, p.y-bs.py) < 0.10 && bs.py > p.y);
    bs.blocked = safe;
    
    const isVell = bs.boss === BOSS_ROSTER.vell;
    if (safe) {
      bs.blockFlash = 0.6; bs.shakeT = 6;
      bs.floatMsgs.push({txt: isVell ? (LANG==='fr'?'PLONGÉ !':'DIVED!') : (LANG==='fr'?'PARÉ !':'BLOCKED!'), life:1, color:'#8cc8ff'});
    } else {
      bs.playerHp -= bs.playerHpMax*0.30; bs.hurtFlash = 0.6; bs.shakeT = 20;
      bs.floatMsgs.push({txt: isVell ? (LANG==='fr'?'VAGUE !':'WAVE!') : 'AoE !', life:1, color:'#e05050'});
    }
  }
  else if (bs.aoePhase==='blast' && bs.aoeT >= 0.45) { bs.aoePhase='idle'; bs.aoeT=0; bs.aoeInterval = 7 + Math.random()*4; }
  bs.blockFlash = Math.max(0, bs.blockFlash - dt);
  bs.hurtFlash = Math.max(0, bs.hurtFlash - dt);
  bs.floatMsgs.forEach(m => m.life -= dt*0.8);
  bs.floatMsgs = bs.floatMsgs.filter(m => m.life > 0);

  if (bossState.playerHp < bossState.playerHpMax*0.35 && bossState.potCd <= 0) {
    bossState.playerHp = Math.min(bossState.playerHpMax, bossState.playerHp + bossState.playerHpMax*0.5);
    bossState.potCd = 4.2;
  }
  if (bossState.playerHp < 1) bossState.playerHp = 1; 
  bossState.hits.forEach(h => h.life -= dt*1.4);
  bossState.hits = bossState.hits.filter(h => h.life > 0);
  drawBossRoom(now/1000);
  
  const hpPct = bossState.maxHp > 0 ? bossState.hp/bossState.maxHp*100 : 0;
  $('bossHpBar').style.width = hpPct+'%';
  $('bossHpBar').classList.toggle('low', hpPct <= 20);
  $('bossHpTxt').innerHTML = `<span class="bhpPct">${hpPct.toFixed(1)}%</span><span class="bhpNum">(${fmt(Math.ceil(bossState.hp))} / ${fmt(bossState.maxHp)})</span>`;
  $('bossTimer').textContent = bossState.shared ? fmtBossCountdown(bossState.expiresAt - Date.now()) : fmtBossCountdown((bossState.duration - bossState.elapsed)*1000);
  $('bossPlayerHp').style.width = (bossState.playerHp/bossState.playerHpMax*100)+'%';
  $('bossPlayerHpTxt').textContent = Math.ceil(bossState.playerHp)+' / '+bossState.playerHpMax+' PV';
  if (bossState.hp <= 0) { endBossFight(true); return; }
  if (bossState.shared && Date.now() > bossState.expiresAt) { endBossFight(false); return; }
  bossState.raf = requestAnimationFrame(bossLoop);
}

// ==== src/combat/boss-render.js ====
function bossProj(nx, ny) { const cv = $('bossCv'); return { x: cv.width*0.5 + (nx-0.5)*cv.width*0.86, y: cv.height*0.10 + ny*cv.height*0.78 }; }
function drawStonePillar(cx, sx, sy, scale) {
  const w = 34*scale, h = 120*scale;
  cx.fillStyle = 'rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(sx, sy, w*0.75, w*0.28, 0, 0, 7); cx.fill(); 
  
  const g = cx.createLinearGradient(sx-w/2, 0, sx+w/2, 0);
  g.addColorStop(0,'#2c3238'); g.addColorStop(.45,'#5a636c'); g.addColorStop(.6,'#6d7681'); g.addColorStop(1,'#333940');
  cx.fillStyle = g; cx.fillRect(sx-w/2, sy-h, w, h);
  
  cx.fillStyle = '#4b535c'; cx.fillRect(sx-w*0.62, sy-h-8*scale, w*1.24, 10*scale);
  cx.fillRect(sx-w*0.62, sy-6*scale, w*1.24, 8*scale);
  
  cx.strokeStyle = 'rgba(0,0,0,.25)'; cx.lineWidth = 1;
  for (let i=1;i<4;i++){ const lx=sx-w/2+w*i/4; cx.beginPath(); cx.moveTo(lx,sy-h+6*scale); cx.lineTo(lx,sy-4*scale); cx.stroke(); }
}
function drawWarlord(cx, sx, sy, r, t) {
  cx.save();
  
  cx.fillStyle='rgba(0,0,0,.45)'; cx.beginPath(); cx.ellipse(sx, sy+r*0.15, r*1.15, r*0.34, 0, 0, 7); cx.fill();
  const glow = 0.5+0.5*Math.sin(t*2);
  
  const body = cx.createLinearGradient(sx, sy-r*1.6, sx, sy+r*0.2);
  body.addColorStop(0,'#7a2d33'); body.addColorStop(.5,'#5a2028'); body.addColorStop(1,'#33121a');
  cx.fillStyle = body;
  cx.beginPath();
  cx.moveTo(sx-r*1.1, sy+r*0.1);
  cx.quadraticCurveTo(sx-r*1.35, sy-r*0.9, sx-r*0.5, sy-r*1.15);
  cx.quadraticCurveTo(sx, sy-r*1.5, sx+r*0.5, sy-r*1.15);
  cx.quadraticCurveTo(sx+r*1.35, sy-r*0.9, sx+r*1.1, sy+r*0.1);
  cx.closePath(); cx.fill();
  
  cx.fillStyle = '#3a161c';
  for (let i=-3;i<=3;i++){ const bx=sx+i*r*0.28, by=sy-r*1.1-Math.abs(i)*r*0.02;
    cx.beginPath(); cx.moveTo(bx-r*0.09,by); cx.lineTo(bx+r*0.09,by); cx.lineTo(bx, by-r*0.4); cx.closePath(); cx.fill(); }
  
  cx.strokeStyle = `rgba(255,90,70,${0.55+0.35*glow})`; cx.lineWidth = 2; cx.shadowColor='#ff5a46'; cx.shadowBlur=12;
  cx.beginPath();
  cx.moveTo(sx-r*0.5,sy-r*0.9); cx.lineTo(sx-r*0.2,sy-r*0.4); cx.lineTo(sx-r*0.35,sy-r*0.1);
  cx.moveTo(sx+r*0.5,sy-r*0.8); cx.lineTo(sx+r*0.25,sy-r*0.35); cx.lineTo(sx+r*0.4,sy);
  cx.stroke(); cx.shadowBlur=0;
  
  cx.fillStyle = '#4a1a20';
  cx.beginPath(); cx.moveTo(sx-r*1.0,sy-r*0.5); cx.lineTo(sx-r*1.5,sy-r*0.1); cx.lineTo(sx-r*1.25,sy-r*0.05); cx.lineTo(sx-r*0.9,sy-r*0.3); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(sx+r*1.0,sy-r*0.5); cx.lineTo(sx+r*1.5,sy-r*0.1); cx.lineTo(sx+r*1.25,sy-r*0.05); cx.lineTo(sx+r*0.9,sy-r*0.3); cx.closePath(); cx.fill();
  
  const hy = sy-r*1.05;
  cx.fillStyle = '#43191f'; cx.beginPath(); cx.arc(sx, hy, r*0.42, 0, 7); cx.fill();
  
  cx.strokeStyle = '#c9b48a'; cx.lineWidth = r*0.16; cx.lineCap='round';
  cx.beginPath(); cx.moveTo(sx-r*0.3, hy-r*0.2); cx.quadraticCurveTo(sx-r*0.75, hy-r*0.7, sx-r*0.55, hy-r*1.0); cx.stroke();
  cx.beginPath(); cx.moveTo(sx+r*0.3, hy-r*0.2); cx.quadraticCurveTo(sx+r*0.75, hy-r*0.7, sx+r*0.55, hy-r*1.0); cx.stroke();
  cx.lineCap='butt';
  
  cx.fillStyle = `rgba(255,${120+100*glow|0},60,1)`; cx.shadowColor='#ffae3a'; cx.shadowBlur=14;
  cx.beginPath(); cx.arc(sx-r*0.16, hy, r*0.09, 0, 7); cx.fill();
  cx.beginPath(); cx.arc(sx+r*0.16, hy, r*0.09, 0, 7); cx.fill();
  cx.shadowBlur=0;
  cx.restore();
}

function drawVell(cx, sx, sy, r, t) {
  cx.save();
  const glow = 0.5+0.5*Math.sin(t*2);
  const sway = Math.sin(t*0.9)*r*0.02;
  cx.fillStyle='rgba(0,0,0,.4)'; cx.beginPath(); cx.ellipse(sx, sy+r*0.5, r*1.15, r*0.26, 0, 0, 7); cx.fill();
  
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
    
    cx.strokeStyle='rgba(160,220,230,.18)'; cx.lineWidth=r*0.02;
    cx.beginPath(); cx.moveTo(r*0.15,-r*0.02); cx.quadraticCurveTo(r*0.75,r*0.05, r*0.85,r*0.9+sway); cx.stroke();
    cx.beginPath(); cx.moveTo(r*0.15,-r*0.02); cx.quadraticCurveTo(r*0.55,r*0.15, r*0.5,r*0.85); cx.stroke();
    cx.restore();
  };
  wingBowl(-1); wingBowl(1);
  
  cx.strokeStyle='#0e1c24'; cx.lineCap='round';
  cx.beginPath(); cx.lineWidth=r*0.09;
  cx.moveTo(sx-r*0.2,sy-r*0.55);
  cx.quadraticCurveTo(sx-r*0.95,sy-r*0.15+sway, sx-r*1.25,sy+r*0.35);
  cx.stroke();
  cx.lineWidth=r*0.035;
  cx.beginPath(); cx.moveTo(sx-r*1.15,sy+r*0.15); cx.quadraticCurveTo(sx-r*1.4,sy+r*0.3+sway, sx-r*1.42,sy+r*0.55); cx.stroke();
  cx.lineCap='butt';
  
  const body = cx.createLinearGradient(sx, sy-r*1.35, sx, sy-r*0.4);
  body.addColorStop(0,'#1c3a4a'); body.addColorStop(.6,'#12222c'); body.addColorStop(1,'#0a1620');
  cx.fillStyle = body;
  cx.beginPath();
  cx.moveTo(sx-r*0.24,sy-r*0.45); cx.quadraticCurveTo(sx-r*0.3,sy-r*0.95, sx-r*0.14,sy-r*1.15);
  cx.quadraticCurveTo(sx,sy-r*1.22, sx+r*0.14,sy-r*1.15);
  cx.quadraticCurveTo(sx+r*0.3,sy-r*0.95, sx+r*0.24,sy-r*0.45);
  cx.quadraticCurveTo(sx,sy-r*0.32, sx-r*0.24,sy-r*0.45);
  cx.closePath(); cx.fill();
  
  cx.fillStyle = '#12222c';
  for (const side of [-1,1]) {
    cx.beginPath(); cx.ellipse(sx+side*r*0.2,sy-r*0.38,r*0.1,r*0.16,side*0.3,0,7); cx.fill();
    cx.strokeStyle='#e8e2d0'; cx.lineWidth=r*0.02; cx.lineCap='round';
    for (let c=-1;c<=1;c++) { cx.beginPath(); cx.moveTo(sx+side*r*0.19+c*r*0.04,sy-r*0.3); cx.lineTo(sx+side*r*0.16+c*r*0.05,sy-r*0.2); cx.stroke(); }
    cx.lineCap='butt';
  }
  
  const hy = sy-r*1.18;
  cx.fillStyle = '#12222c';
  cx.beginPath(); cx.ellipse(sx,hy,r*0.22,r*0.19,0,0,7); cx.fill();
  cx.beginPath(); cx.ellipse(sx,hy+r*0.15,r*0.13,r*0.11,0,0,7); cx.fill();
  
  cx.fillStyle = '#0e1c24';
  const ridge = [[-0.3,-0.95,0.55],[-0.12,-1.1,0.75],[0.06,-1.15,0.8],[0.24,-1.05,0.65],[0.4,-0.85,0.45]];
  for (const [dx,dy,len] of ridge) {
    const bx=sx+dx*r*0.4, by=hy+dy*r*0.4;
    cx.beginPath();
    cx.moveTo(bx-r*0.035,by); cx.lineTo(bx+dx*r*0.25*len, by+dy*r*0.35*len); cx.lineTo(bx+r*0.035,by);
    cx.closePath(); cx.fill();
  }
  
  cx.fillStyle='#4a0e0e'; cx.beginPath(); cx.ellipse(sx,hy+r*0.18,r*0.13,r*0.1,0,0,Math.PI); cx.fill();
  cx.fillStyle='#e8e2d0';
  for (let i=-2;i<=2;i++) { const tx=sx+i*r*0.05;
    cx.beginPath(); cx.moveTo(tx-r*0.02,hy+r*0.1); cx.lineTo(tx,hy+r*0.21); cx.lineTo(tx+r*0.02,hy+r*0.1); cx.closePath(); cx.fill(); }
  
  cx.fillStyle = `rgba(255,${60+40*glow|0},60,1)`; cx.shadowColor='#ff3a3a'; cx.shadowBlur=12;
  cx.beginPath(); cx.arc(sx-r*0.08,hy-r*0.02,r*0.04,0,7); cx.fill();
  cx.beginPath(); cx.arc(sx+r*0.08,hy-r*0.02,r*0.04,0,7); cx.fill();
  cx.shadowBlur=0;
  cx.restore();
}

function drawBossCreature(bossId, cx, sx, sy, r, t) {
  if (bossId === 'vell') return drawVell(cx, sx, sy, r, t);
  return drawWarlord(cx, sx, sy, r, t);
}

const VELL_BOATS = [ {x:0.04, y:0.92}, {x:0.96, y:0.92} ];
const VELL_BOAT_SCALE = 13; 

const VELL_ANCHORS = [ {x:0.16, y:0.74}, {x:0.84, y:0.74} ];
function drawVellBoat(cx, sx, sy, scale, facingRight) {
  cx.save(); cx.translate(sx,sy); if (!facingRight) cx.scale(-1,1); cx.scale(scale,scale);
  cx.fillStyle='rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(0,4,26,7,0,0,7); cx.fill();
  cx.fillStyle='#3a2c1e'; 
  cx.beginPath(); cx.moveTo(-22,0); cx.quadraticCurveTo(-24,8,-14,9); cx.lineTo(20,9); cx.quadraticCurveTo(26,4,20,0); cx.closePath(); cx.fill();
  cx.strokeStyle='#241a10'; cx.lineWidth=1; cx.beginPath(); cx.moveTo(-20,3); cx.lineTo(18,3); cx.stroke();
  cx.strokeStyle='#5a4630'; cx.lineWidth=1.6; cx.beginPath(); cx.moveTo(-4,0); cx.lineTo(-4,-26); cx.stroke(); 
  cx.fillStyle='#c9c2a8'; cx.beginPath(); cx.moveTo(-4,-25); cx.lineTo(12,-16); cx.lineTo(-4,-9); cx.closePath(); cx.fill(); 
  cx.restore();
}
function drawBossRoom(t) {
  const cx = bossCtx, cv = $('bossCv'), W = cv.width, H = cv.height, bs = bossState;
  const isVell = bs.boss === BOSS_ROSTER.vell;
  cx.save();
  
  if (bs.shakeT > 0) cx.translate((Math.random()-0.5)*bs.shakeT, (Math.random()-0.5)*bs.shakeT);
  if (isVell) {
    
    const sky = cx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#8fb8c9'); sky.addColorStop(.42,'#4a7a8f'); sky.addColorStop(.55,'#1c4a5e'); sky.addColorStop(1,'#0a2430');
    cx.fillStyle = sky; cx.fillRect(0,0,W,H);
    
    const gapL = W*0.40, gapR = W*0.60;
    cx.fillStyle = 'rgba(10,20,26,.6)';
    cx.beginPath(); cx.moveTo(0,H*.5);
    for (let i=0;i<=8;i++) { const x=i/8*gapL; cx.lineTo(x, H*.42 - Math.abs(Math.sin(i*2.3+3))*H*.16); }
    cx.lineTo(gapL,H*.5); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(gapR,H*.5);
    for (let i=0;i<=8;i++) { const x=gapR+i/8*(W-gapR); cx.lineTo(x, H*.42 - Math.abs(Math.sin(i*2.1+11))*H*.16); }
    cx.lineTo(W,H*.5); cx.closePath(); cx.fill();
    
    cx.fillStyle = 'rgba(6,14,18,.75)';
    const rockSpike = (sx, h) => { cx.beginPath(); cx.moveTo(sx-18,H*.58); cx.lineTo(sx,H*.58-h); cx.lineTo(sx+18,H*.58); cx.closePath(); cx.fill(); };
    rockSpike(gapL-10, H*.22);
    rockSpike(gapR+10, H*.24);
    
    cx.strokeStyle='rgba(255,255,255,.10)'; cx.lineWidth=1;
    for (let i=0;i<9;i++) { const y = H*.5 + i*(H*.5/9);
      cx.beginPath();
      for (let x=0;x<=W;x+=24) cx.lineTo(x, y+Math.sin(x*0.03+t*1.2+i)*3);
      cx.stroke();
    }
  } else {
    
    const bg = cx.createLinearGradient(0,0,0,H);
    bg.addColorStop(0,'#1a2830'); bg.addColorStop(.55,'#223038'); bg.addColorStop(1,'#10171c');
    cx.fillStyle = bg; cx.fillRect(0,0,W,H);
    
    cx.strokeStyle = 'rgba(0,0,0,.28)'; cx.lineWidth = 1;
    for (let i=0;i<=10;i++){ const p=bossProj(0,i/10); cx.beginPath(); cx.moveTo(0,p.y); cx.lineTo(W,p.y); cx.stroke(); }
    for (let i=0;i<=8;i++){ const top=bossProj(i/8,0), bot=bossProj(i/8,1); cx.beginPath(); cx.moveTo(top.x,top.y); cx.lineTo(bot.x,bot.y); cx.stroke(); }
  }
  
  const fogDrift = Math.sin(t*0.15)*16;
  const fog = cx.createRadialGradient(W/2+fogDrift, H*0.32, W*0.08, W/2+fogDrift, H*0.32, W*0.8);
  fog.addColorStop(0,'rgba(255,255,255,0)'); fog.addColorStop(1,`rgba(0,0,0,${isVell?.22:.4})`);
  cx.fillStyle = fog; cx.fillRect(0,0,W,H);
  if (isVell) { 
    drawVellBoat(cx, W*VELL_BOATS[0].x, H*VELL_BOATS[0].y, VELL_BOAT_SCALE, true);
    drawVellBoat(cx, W*VELL_BOATS[1].x, H*VELL_BOATS[1].y, VELL_BOAT_SCALE, false);
  }
  
  for (const e of bs.embers) {
    if (e.depth > 0.6) continue; 
    const ex = (e.x + Math.sin(e.sway)*0.01)*W, ey = e.y*H;
    cx.globalAlpha = e.life*0.35*e.depth; cx.fillStyle = '#ff8a4a'; cx.shadowColor='#ff5a2a'; cx.shadowBlur = 6;
    cx.beginPath(); cx.arc(ex, ey, 1+1.5*e.depth, 0, 7); cx.fill();
  }
  cx.globalAlpha = 1; cx.shadowBlur = 0;
  
  const bpos = bossProj(0.5, 0.12); const r = Math.min(W,H)*0.14;
  cx.save();
  cx.translate(bpos.x, bpos.y);
  cx.transform(1, 0, 0.05*Math.sin(t*0.6), 1+0.015*Math.sin(t*1.3), 0, 0);
  drawBossCreature(bs.bossId, cx, 0, 0, r, t);
  cx.restore();
  
  for (const e of bs.embers) {
    if (e.depth <= 0.6) continue;
    const ex = (e.x + Math.sin(e.sway)*0.015)*W, ey = e.y*H;
    cx.globalAlpha = e.life*0.55*e.depth; cx.fillStyle = '#ffb066'; cx.shadowColor='#ff5a2a'; cx.shadowBlur = 8;
    cx.beginPath(); cx.arc(ex, ey, 1.5+2*e.depth, 0, 7); cx.fill();
  }
  cx.globalAlpha = 1; cx.shadowBlur = 0;
  
  if (isVell) {
    for (const h of bs.hits) {
      const boat = VELL_BOATS[h.x < 0.5 ? 0 : 1];
      const bx = W*boat.x, by = H*boat.y - VELL_BOAT_SCALE*12; 
      const prog = 1-h.life; 
      const px = bx + (bpos.x-bx)*prog;
      const py = by + (bpos.y-by)*prog - Math.sin(prog*Math.PI)*70; 
      cx.fillStyle = '#1a1a1a';
      cx.beginPath(); cx.arc(px, py, 4.5, 0, 7); cx.fill();
      cx.strokeStyle = 'rgba(200,200,200,.4)'; cx.lineWidth = 1.5;
      cx.beginPath(); cx.moveTo(px,py); cx.lineTo(px-(bpos.x-bx)*0.05, py-(bpos.y-by)*0.05+8); cx.stroke();
    }
  }
  
  for (const h of bs.hits) {
    const hy = bpos.y - (1-h.life)*40;
    cx.globalAlpha = Math.max(0,h.life);
    cx.font = h.crit?'bold 24px Georgia':'18px Georgia'; cx.textAlign='center';
    cx.fillStyle = h.crit?'#ffbe78':'#fff';
    cx.fillText('-'+fmt(Math.ceil(h.dmg))+(h.crit?'!':''), bpos.x+(h.x-.5)*r*2.4, hy);
    cx.globalAlpha = 1;
  }
  cx.textAlign='left';
  
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
    
    for (const p of bs.pillars) { const s = bossProj(p.x, p.y+0.05);
      cx.fillStyle = 'rgba(120,180,255,.16)'; cx.beginPath(); cx.ellipse(s.x, s.y, 40, 16, 0, 0, 7); cx.fill(); }
  }
  
  const drawables = bs.pillars.map((p,pi) => ({ ny:p.y, fn:()=>{
    const s = bossProj(p.x,p.y);
    if (isVell) {
      
      const boat = VELL_BOATS[pi] || VELL_BOATS[0];
      const bx = W*boat.x, by = H*boat.y - VELL_BOAT_SCALE*12;
      cx.strokeStyle='rgba(90,90,90,.55)'; cx.lineWidth=2;
      cx.beginPath(); cx.moveTo(bx,by); cx.lineTo(s.x,s.y-14); cx.stroke();
      cx.fillStyle='rgba(0,0,0,.3)'; cx.beginPath(); cx.ellipse(s.x,s.y+2,12,4.5,0,0,7); cx.fill();
      cx.strokeStyle='#7a7a78'; cx.lineWidth=2.4; cx.lineCap='round';
      cx.beginPath(); cx.moveTo(s.x,s.y-14); cx.lineTo(s.x,s.y-2); cx.stroke(); 
      cx.beginPath(); cx.arc(s.x,s.y-14,3,0,7); cx.stroke(); 
      cx.beginPath(); cx.arc(s.x,s.y-3,6,Math.PI*0.15,Math.PI*0.85); cx.stroke(); 
      cx.beginPath(); cx.moveTo(s.x-6,s.y-3); cx.lineTo(s.x-9,s.y-8); cx.moveTo(s.x+6,s.y-3); cx.lineTo(s.x+9,s.y-8); cx.stroke(); 
      cx.beginPath(); cx.moveTo(s.x-9,s.y-13); cx.lineTo(s.x+9,s.y-13); cx.stroke(); 
    } else drawStonePillar(cx, s.x, s.y, Math.min(W,H)/500*1.6);
  } }));
  
  const dodgingNow = bs.aoePhase==='telegraph' || bs.aoePhase==='blast';
  const nearBuoy = isVell && bs.pillars.some(p => Math.hypot(p.x-bs.px, p.y-bs.py) < 0.10 && bs.py > p.y);
  const diving = isVell && dodgingNow && nearBuoy;
  drawables.push({ ny:bs.py, fn:()=>{
    const s = bossProj(bs.px, bs.py);
    if (diving) {
      
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
    
    if (bs.blockFlash>0) { cx.strokeStyle=`rgba(140,200,255,${bs.blockFlash})`; cx.lineWidth=3; cx.beginPath(); cx.arc(s.x, s.y-18, 20, 0, 7); cx.stroke(); }
    const hurt = bs.hurtFlash>0;
    cx.fillStyle = hurt ? '#c0554533' : '#3b6ea8';
    cx.beginPath(); cx.moveTo(s.x, s.y-36); cx.lineTo(s.x-10, s.y); cx.lineTo(s.x+10, s.y); cx.closePath(); cx.fill();
    cx.fillStyle = hurt ? '#e0a0a0' : '#e8d0a0'; cx.beginPath(); cx.arc(s.x, s.y-38, 5.5, 0, 7); cx.fill();
    cx.fillStyle = '#2a4a7a'; cx.beginPath(); cx.moveTo(s.x-7,s.y-38); cx.lineTo(s.x+7,s.y-38); cx.lineTo(s.x,s.y-50); cx.closePath(); cx.fill();
  }});
  
  if (bs.shared) {
    for (const uid in otherFighters) {
      const f = otherFighters[uid];
      if (!f || typeof f.px !== 'number' || typeof f.py !== 'number') continue;
      const p = otherFightersPos[uid] || { x:f.px, y:f.py }; 
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
  
  for (const m of bs.floatMsgs) {
    const s = bossProj(bs.px, bs.py);
    cx.globalAlpha = Math.max(0, Math.min(1, m.life));
    cx.font = 'bold 18px Georgia'; cx.textAlign='center'; cx.fillStyle = m.color;
    cx.fillText(m.txt, s.x, s.y-56-(1-m.life)*24);
    cx.globalAlpha = 1;
  }
  cx.textAlign='left'; cx.textBaseline='alphabetic';
  
  const hpFrac = bs.maxHp > 0 ? Math.max(0, bs.hp/bs.maxHp) : 1;
  const breathe = 1 + Math.sin(t*2.2)*(hpFrac<0.3?0.18:0.05);
  const vigStrength = (0.14 + (1-hpFrac)*0.36) * breathe;
  const vig = cx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,H*0.78);
  vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(1,`rgba(140,20,20,${Math.min(0.6,vigStrength)})`);
  cx.fillStyle = vig; cx.fillRect(0,0,W,H);
  cx.restore(); 
}

// ==== src/inventory/inventory-ui.js ====
const invPanelOpen = true; 

const PD_LEFT  = ['helmet','armor','gloves','boots'];

const PD_RIGHT = ['necklace','ring1','ring2','earring1','earring2','belt'];
const PD_BOTTOM = ['weapon','awakening','secondary'];
const SLOT_LABEL = { weapon:'Arme princ.', awakening:'Éveil', secondary:'Arme secondaire', book:'Livre (vie)',
  helmet:'Casque', armor:'Armure', gloves:'Gants', boots:'Bottes',
  necklace:'Collier', earring1:'B. oreille', earring2:'B. oreille', ring1:'Bague', ring2:'Bague', belt:'Ceinture',
  artifact1:'Artéfact', artifact2:'Artéfact', eqStone:'Pierre d\'alchimie' };

const SLOT_ICON = { weapon:staffIconForColor('#8f9aa6','grey'), awakening:orbPairIconForColor('#8f9aa6','grey'),
  secondary:daggerIconForColor('#8f9aa6','grey'), book:ICO_BOOK,
  helmet:helmetIconForColor('#8f9aa6','grey'), armor:armorIconForColor('#8f9aa6','grey'),
  gloves:glovesIconForColor('#8f9aa6','grey'), boots:bootsIconForColor('#8f9aa6','grey'),
  necklace:necklaceIconForTier(0,'#8f9aa6'), earring1:earringIconForTier(0,'#8f9aa6'), earring2:earringIconForTier(0,'#8f9aa6'),
  ring1:ringIconForTier(0,'#8f9aa6'), ring2:ringIconForTier(0,'#8f9aa6'), belt:ICO_BELT,
  artifact1:ICO_ARTIFACT, artifact2:ICO_ARTIFACT, eqStone:ICO_EQSTONE };

function renderEquipment() {
  drawPreviewChar();
  fillPdCol('pdLeft', PD_LEFT);
  fillPdCol('pdRight', PD_RIGHT);
  fillPdCol('pdWeapons', PD_BOTTOM);
  
  fillPdCol('pdBook', ['artifact1','artifact2','eqStone','book']);
  
  $('stWeaponBonus').textContent = '+' + Math.round(enhBonus(EQUIP.weapon ? EQUIP.weapon.enhLv : 0) * 100) + '%';
  $('stArmorBonus').textContent = '+' + Math.round(armorBonusAvg() * 100) + '%';
  
  $('eqSumAp').textContent = (LANG==='fr'?'PA ':'AP ') + Math.floor(apEff());
  $('eqSumDp').textContent = (LANG==='fr'?'PD ':'DP ') + Math.floor(totalDP());
  $('eqSumGs').textContent = 'GS ' + Math.round(GS());
}

function enhShortLabel(lvl) {
  if (lvl < PRI_IDX) return '+' + lvl;
  return ['I','II','III','IV','V'][lvl - PRI_IDX] || '+' + lvl;
}
function pdSlotInnerHtmlFor(id, e) {
  const icon = (e ? (e.icon || SLOT_ICON[id]) : SLOT_ICON[id]);
  let badge = '';
  if (e && e.optimizable) {
    const lvl = e.enhLv || 0;
    badge = `<span class="enh${lvl>=PRI_IDX?' pri':''}">${enhShortLabel(lvl)}</span>`;
  } else if (e && e.ap) {
    badge = `<span class="enh">+${e.ap}</span>`;
  }
  
  let apDpBadge = '';
  if (e) {
    const { ap, dp } = effectiveApDp(e);
    if (ap) apDpBadge += `<span class="pdAp">${ap}</span>`;
    if (dp) apDpBadge += `<span class="pdDp">${dp}</span>`;
  }
  
  const optBadge = (e && e.optimizable) ? `<span class="pdOptBtn" title="${LANG==='fr'?'Optimiser':'Enhance'}">🔧</span>` : '';
  
  let goBadge = '';
  if (e) {
    if (upgradeZonesForEquippedSlot(id, e).length) goBadge = `<span class="pdUpgradeBtn" title="${LANG==='fr'?'Zone pour améliorer':'Zone to upgrade'}">⬆️</span>`;
  } else if (NO_SOURCE_SLOTS.includes(id)) {
    goBadge = `<span class="pdLockBtn" title="${LANG==='fr'?'Pas encore disponible':'Not available yet'}">🔒</span>`;
  } else if (zonesForSlot(id).length) {
    
    goBadge = `<span class="pdFarmBtn" title="${LANG==='fr'?'Zone pour trouver ce stuff':'Zone to find this gear'}">⬆️</span>`;
  }
  const cornerHtml = (optBadge || goBadge) ? `<span class="pdCorner">${optBadge}${goBadge}</span>` : '';
  
  const unequipBadge = e ? `<span class="pdUnequipBtn" title="${LANG==='fr'?'Déséquiper':'Unequip'}">✕</span>` : '';
  return icon + badge + apDpBadge + cornerHtml + unequipBadge;
}
function pdSlotInnerHtml(id) { return pdSlotInnerHtmlFor(id, EQUIP[id]); }

function pdStatSuffix(e) {
  const { ap, dp, hp, dodge } = effectiveApDp(e);
  const parts = [];
  if (ap) parts.push('+'+ap+' PA');
  if (dp) parts.push('+'+dp+' PD');
  if (hp) parts.push('+'+hp+' PV');
  if (dodge) parts.push('+'+dodge+'% Esq.');
  return parts.length ? ' (' + parts.join(' ') + ')' : '';
}

function accBaseSlot(slotId) {
  if (slotId==='ring1'||slotId==='ring2') return 'ring';
  if (slotId==='earring1'||slotId==='earring2') return 'earring';
  return slotId;
}

const NO_SOURCE_SLOTS = ['artifact1','artifact2','eqStone'];

const JEWELRY_SLOTS = ['ring1','ring2','necklace','earring1','earring2','belt'];

function slotCandidateZones(slotId) {
  const tier = gearTierForZone(zoneIdx);
  if (WEAPON_SLOTS.includes(slotId)) {
    return tier.zones.filter(zi => (ZONE_WEAPON_SLOTS[zi]||[]).includes(slotId));
  } else if (ARMOR_SLOTS.includes(slotId)) {
    return tier.zones.filter(zi => (ZONE_ARMOR_SLOTS[zi]||[]).includes(slotId));
  } else if (JEWELRY_SLOTS.includes(slotId)) {
    const base = accBaseSlot(slotId);
    return tier.zones.filter(zi => accSlotFor(ZONES[zi].loot.jackpot) === base);
  }
  return [];
}

function slotCandidateZonesAllTiers(slotId) {
  const allZoneIdx = ZONES.map((_, zi) => zi);
  if (WEAPON_SLOTS.includes(slotId)) {
    return allZoneIdx.filter(zi => (ZONE_WEAPON_SLOTS[zi]||[]).includes(slotId));
  } else if (ARMOR_SLOTS.includes(slotId)) {
    return allZoneIdx.filter(zi => (ZONE_ARMOR_SLOTS[zi]||[]).includes(slotId));
  } else if (JEWELRY_SLOTS.includes(slotId)) {
    const base = accBaseSlot(slotId);
    return allZoneIdx.filter(zi => accSlotFor(ZONES[zi].loot.jackpot) === base);
  }
  return [];
}

function zonesForSlot(slotId) {
  const zones = slotCandidateZones(slotId);
  const safe = zones.filter(zi => bottleneck(ZONES[zi]) >= 0.6);
  return safe.length ? safe : zones;
}

function safeZonesForSlot(slotId) {
  return slotCandidateZonesAllTiers(slotId).filter(zi => bottleneck(ZONES[zi]) >= 0.6);
}

function itemTierIdx(item) { return GEAR_TIERS.findIndex(t => t.color === item.color); }

function upgradeZonesForEquippedSlot(id, e) {
  if (!e) return [];
  const eTier = itemTierIdx(e);
  return safeZonesForSlot(id).filter(zi => (atVelia || zi !== zoneIdx) && GEAR_TIERS.indexOf(gearTierForZone(zi)) > eTier);
}

function ownedBetterInBagForSlot(slotId) {
  const accSlot = JEWELRY_SLOTS.includes(slotId) ? accBaseSlot(slotId) : null;
  const ref = refScoreForSlot(slotId, accSlot);
  const wantSlot = accSlot || slotId;
  return INV.some(it => it && (it.kind==='gear' || it.kind==='jackpot') && it.slot === wantSlot && itemScore(it) > ref);
}

function zonesOfferingUpgrade() {
  const zones = new Set();
  for (const slotId of [...WEAPON_SLOTS, ...ARMOR_SLOTS, ...JEWELRY_SLOTS]) {
    if (ownedBetterInBagForSlot(slotId)) continue; 
    const e = EQUIP[slotId];
    const list = e ? upgradeZonesForEquippedSlot(slotId, e) : zonesForSlot(slotId).filter(zi => bottleneck(ZONES[zi]) >= 0.6);
    list.forEach(zi => zones.add(zi));
  }
  return zones;
}

function slotsUpgradedByZone(zi) {
  const slots = [];
  for (const slotId of [...WEAPON_SLOTS, ...ARMOR_SLOTS, ...JEWELRY_SLOTS]) {
    if (ownedBetterInBagForSlot(slotId)) continue; 
    const e = EQUIP[slotId];
    const list = e ? upgradeZonesForEquippedSlot(slotId, e) : zonesForSlot(slotId).filter(z => bottleneck(ZONES[z]) >= 0.6);
    if (list.includes(zi)) slots.push(slotId);
  }
  return slots;
}

function highlightEquipSlotsForZone(slots) {
  document.querySelectorAll('.pdSlot').forEach(el => el.classList.remove('pdFarmZoneHalo'));
  slots.forEach(id => { const el = document.querySelector(`.pdSlot[data-slot="${id}"]`); if (el) el.classList.add('pdFarmZoneHalo'); });
}

function highlightFarmZones(zones) {
  document.querySelectorAll('#zoneList .zRow').forEach(r => r.classList.remove('eqFarmHalo'));
  zones.forEach(zi => { const row = document.querySelector(`#zoneList .zRow[data-zi="${zi}"]`); if (row) row.classList.add('eqFarmHalo'); });
}

function showEquipSlotMenu(cell, slotId) {
  const e = EQUIP[slotId];
  const pop = $('itemPop');
  let html = `<div class="ipName gear">${SLOT_LABEL[slotId] || slotId}</div>`;
  const emptyTxt = NO_SOURCE_SLOTS.includes(slotId)
    ? (LANG==='fr'?'🔒 Pas encore disponible':'🔒 Not available yet')
    : (LANG==='fr'?'Rien d\'équipé':'Nothing equipped');
  html += `<div class="ipDesc">${e ? (escapeHtml(e.name)+pdStatSuffix(e)) : emptyTxt}</div>`;
  pop.innerHTML = html;
  let farmZones = [];
  if (!e && !NO_SOURCE_SLOTS.includes(slotId)) {
    farmZones = zonesForSlot(slotId);
    if (farmZones.length) {
      const box = document.createElement('div');
      box.className = 'ipDesc';
      box.style.marginTop = '6px';
      box.innerHTML = (LANG==='fr' ? '📍 Où farmer : ' : '📍 Where to farm: ') +
        farmZones.map(zi => `<button class="eqFarmZoneBtn" data-zi="${zi}">${tr(ZONES[zi].name)}</button>`).join(' ');
      pop.appendChild(box);
      box.querySelectorAll('.eqFarmZoneBtn').forEach(btn => {
        btn.onclick = ev => {
          ev.stopPropagation();
          const zi = parseInt(btn.dataset.zi, 10);
          if (atVelia || zi !== zoneIdx) travelTo(zi);
          hideItemPop();
        };
      });
    }
  }
  highlightFarmZones(farmZones);
  pop.style.display = 'block';
  const r = cell.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  pop.style.left = Math.min(r.right + 8, window.innerWidth - pr.width - 10) + 'px';
  pop.style.top = Math.min(r.top, window.innerHeight - pr.height - 10) + 'px';
}
function fillPdCol(colId, ids) {
  const col = $(colId);
  col.innerHTML = '';
  for (const id of ids) {
    const e = EQUIP[id];
    const div = document.createElement('div');
    div.className = 'pdSlot ' + (e ? 'filled' : 'empty');
    div.dataset.slot = id;
    div.title = SLOT_LABEL[id] + (e ? ' — ' + e.name + pdStatSuffix(e) : ' (vide)');
    div.innerHTML = pdSlotInnerHtml(id);
    
    if (e && e.color) div.style.boxShadow = `0 0 8px 2px ${e.color}66`;
    else div.style.boxShadow = '';
    
    div.style.borderColor = (e && e.color && JEWELRY_SLOTS.includes(id)) ? e.color : '';
    div.onclick = ev => { ev.stopPropagation(); hideItemTooltip(); showEquipSlotMenu(div, id); };
    div.ondblclick = ev => { ev.stopPropagation(); hideItemPop(); if (e) unequip(id); };
    const optBtn = div.querySelector('.pdOptBtn');
    if (optBtn) optBtn.onclick = ev => {
      ev.stopPropagation(); hideItemTooltip(); hideItemPop();
      optTarget = { loc:'equip', key:id }; renderOptimization();
      $('optCard').scrollIntoView({ behavior:'smooth', block:'center' });
    };
    
    const unequipBtn = div.querySelector('.pdUnequipBtn');
    if (unequipBtn) unequipBtn.onclick = ev => {
      ev.stopPropagation(); hideItemTooltip(); hideItemPop();
      unequip(id);
    };
    
    const goBtn = div.querySelector('.pdUpgradeBtn, .pdFarmBtn');
    if (goBtn) goBtn.onclick = ev => {
      ev.stopPropagation(); hideItemTooltip(); hideItemPop();
      const zones = e ? upgradeZonesForEquippedSlot(id, e) : zonesForSlot(id);
      if (zones.length) { const zi = zones[0]; if (atVelia || zi !== zoneIdx) travelTo(zi); }
    };
    col.appendChild(div);
  }
}

function refreshEquipSlot(slotId) {
  const div = document.querySelector('.pdSlot[data-slot="'+slotId+'"]');
  if (!div) return;
  const e = EQUIP[slotId];
  div.className = 'pdSlot ' + (e ? 'filled' : 'empty');
  div.title = SLOT_LABEL[slotId] + (e ? ' — ' + e.name + pdStatSuffix(e) : ' (vide)');
  div.innerHTML = pdSlotInnerHtml(slotId);
  div.style.boxShadow = (e && e.color) ? `0 0 8px 2px ${e.color}66` : '';
  div.style.borderColor = (e && e.color && JEWELRY_SLOTS.includes(slotId)) ? e.color : '';
}

function drawPreviewChar() {
  const c = $('charPrev'), x = c.getContext('2d');
  x.clearRect(0,0,c.width,c.height);
  x.fillStyle = 'rgba(201,165,90,.12)';
  x.beginPath(); x.ellipse(60,184,38,9,0,0,7); x.fill();
  
  drawWitchOn(x, 60, 150, 2.5);
}

function drawWitchOn(x, cx, cy, sc) {
  x.save(); x.translate(cx,cy); x.scale(sc,sc);
  witchBodyOn(x, performance.now()/1000, false);
  x.restore();
}

const INV_CATEGORIES = [
  { id:'normal',      icon:'⚔️', label:{fr:'Equip.',en:'Gear'},    kinds:['gear','jackpot'] },
  { id:'opt',         icon:'✦',  label:{fr:'Opti.',en:'Enh.'}, kinds:['material','craft'] },
  
  { id:'crystal',     icon:'💎', label:{fr:'Cristal',en:'Crystal'}, kinds:['crystal'], locked:true },
  
  { id:'treasure',    icon:'🗺️', label:{fr:'Trésors',en:'Treasures'}, kinds:['treasure'] },
  { id:'consumable',  icon:'🧪', label:{fr:'Conso.',en:'Cons.'},   kinds:['consumable'], locked:true },
  { id:'rng',         icon:'🎲', label:{fr:'RNG',en:'RNG'},          kinds:['rngbox'], locked:true },
];
let invCategory = 'normal';

function renderInvCatTabs() {
  const el = $('invCatTabs'); if (!el) return;
  el.innerHTML = INV_CATEGORIES.map(c => `<button class="catTab${c.id===invCategory?' active':''}${c.locked?' locked':''}"` +
    `${c.locked?' disabled title="'+(LANG==='fr'?'Bientôt disponible':'Coming soon')+'"':''} data-cat="${c.id}">` +
    `${c.locked?'<span class="zoneTierLock">🔒</span>':''}<span class="zoneTierLabel">${c.icon} ${c.label[LANG]}</span></button>`).join('');
  el.querySelectorAll('.catTab:not(.locked)').forEach(btn => {
    btn.onclick = () => {
      invCategory = btn.dataset.cat;
      el.querySelectorAll('.catTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderInventory();
    };
  });
}

function cellEnhBadgeHtml(s) {
  if (!s.optimizable) return '';
  const lvl = s.enhLv || 0;
  return `<span class="cellEnh${lvl>=PRI_IDX?' pri':''}">${enhShortLabel(lvl)}</span>`;
}

let hoverInvIndex = -1;
let lastMouseX = 0, lastMouseY = 0;
function renderInventory() {
  const grid = $('invGrid');
  grid.innerHTML = '';
  renderTreasureCraftPanel();
  const cat = INV_CATEGORIES.find(c => c.id === invCategory) || INV_CATEGORIES[0];
  for (let i = 0; i < INV_SIZE; i++) {
    const s = INV[i];
    const cell = document.createElement('div');
    
    const visible = cat.kinds === null || (s && cat.kinds.includes(s.kind));
    cell.className = 'cell' + (s ? ' has k-'+s.kind : '') + (visible ? '' : ' catHidden');
    if (s) {
      const cellApDp = (s.kind === 'gear' || s.kind === 'jackpot') ? effectiveApDp(s) : null;
      
      if (s.color && (s.kind === 'gear' || s.kind === 'material' || s.kind === 'jackpot')) {
        cell.style.borderColor = s.color;
        cell.style.boxShadow = `inset 0 0 6px ${s.color}55`;
      }
      
      const cellIcon = s.icon || (s.slot && SLOT_ICON[s.slot]) || '❔';
      cell.innerHTML = `<span style="color:${s.color}">${cellIcon}</span>` +
        cellEnhBadgeHtml(s) +
        (s.qty > 1 ? `<span class="qty">${fmt(s.qty)}</span>` : '') +
        (s.equipped ? `<span class="eqd">E</span>` : '') +
        (cellApDp && cellApDp.ap ? `<span class="cellAp">${cellApDp.ap}</span>` : '') +
        (cellApDp && cellApDp.dp ? `<span class="cellDp">${cellApDp.dp}</span>` : '');
      cell.onmouseenter = ev => { hoverInvIndex = i; lastMouseX = ev.clientX; lastMouseY = ev.clientY; showItemTooltip(ev.clientX, ev.clientY, { invIndex:i, ...s }); };
      cell.onmousemove  = ev => { lastMouseX = ev.clientX; lastMouseY = ev.clientY; moveItemTooltip(ev.clientX, ev.clientY); };
      cell.onmouseleave = () => { if (hoverInvIndex === i) hoverInvIndex = -1; hideItemTooltip(); };
      cell.onclick = ev => { ev.stopPropagation(); hideItemTooltip(); showItemMenuAtCell(cell, { invIndex:i, ...s }); };
      cell.ondblclick = ev => { ev.stopPropagation(); hideItemTooltip(); quickAction(i); };
      cell.oncontextmenu = ev => { ev.preventDefault(); ev.stopPropagation(); hideItemTooltip(); showItemMenu(ev.clientX, ev.clientY, { invIndex:i, ...s }); };
    } else {
      
      cell.onclick = ev => { ev.stopPropagation(); showFarmGuide(); };
    }
    grid.appendChild(cell);
  }
  
  const anyVisible = INV.some(s => s && cat.kinds.includes(s.kind));
  if (!anyVisible) {
    const empty = document.createElement('div');
    empty.className = 'invCatEmpty';
    empty.textContent = cat.id === 'rng'
      ? (LANG==='fr'?'Aucun coffre RNG pour l\'instant':'No RNG box yet')
      : (LANG==='fr'?'Vide':'Empty');
    grid.appendChild(empty);
  }
  
  if (hoverInvIndex !== -1) {
    const s = INV[hoverInvIndex];
    if (s) showItemTooltip(lastMouseX, lastMouseY, { invIndex:hoverInvIndex, ...s });
    else { hoverInvIndex = -1; hideItemTooltip(); }
  }
  
  const used = invUsed();
  $('slotTxtH').textContent = used+'/'+INV_SIZE;
  
  const w = invWeight(), mw = MAX_WEIGHT(), overW = w > mw;
  $('wBar').style.width = Math.min(100, w/mw*100)+'%';
  $('wBar').classList.toggle('over', overW);
  $('wTxt').textContent = w.toFixed(1)+' / '+mw+' LT';
  $('wTxt').classList.toggle('bad', overW);
  $('invSilver').textContent = fmt(S.silver);
  $('invLoyalty').textContent = '🏅 '+fmt(S.loyalty||0);
}

function renderCompendiumPane() {
  const grid = $('compGrid'); if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < INV_SIZE; i++) {
    const s = COMPENDIUM_BAG[i];
    const cell = document.createElement('div');
    cell.className = 'cell' + (s ? ' has k-'+s.kind : '');
    if (s) {
      const cellApDp = effectiveApDp(s);
      const cellIcon = s.icon || (s.slot && SLOT_ICON[s.slot]) || '❔';
      cell.innerHTML = `<span style="color:${s.color}">${cellIcon}</span>` +
        cellEnhBadgeHtml(s) +
        (cellApDp && cellApDp.ap ? `<span class="cellAp">${cellApDp.ap}</span>` : '') +
        (cellApDp && cellApDp.dp ? `<span class="cellDp">${cellApDp.dp}</span>` : '') +
        `<span class="compOptBtn" title="${LANG==='fr'?'Équiper et optimiser':'Equip and optimize'}">✦</span>`;
      if (s.color) { cell.style.borderColor = s.color; cell.style.boxShadow = `inset 0 0 6px ${s.color}55`; }
      cell.onmouseenter = ev => { lastMouseX = ev.clientX; lastMouseY = ev.clientY; showItemTooltip(ev.clientX, ev.clientY, s); };
      cell.onmousemove  = ev => { lastMouseX = ev.clientX; lastMouseY = ev.clientY; moveItemTooltip(ev.clientX, ev.clientY); };
      cell.onmouseleave = () => hideItemTooltip();
      
      cell.onclick = ev => { ev.stopPropagation(); hideItemTooltip(); showItemMenuAtCell(cell, { compIndex:i, ...s }); };
    }
    grid.appendChild(cell);
  }
  const empty = $('compGridEmpty');
  if (empty) empty.style.display = COMPENDIUM_BAG.some(Boolean) ? 'none' : '';
}

function veliaChestFreeSlot() {
  for (let i = 0; i < VELIA_CHEST_OPEN; i++) if (!VELIA_CHEST[i]) return i;
  return -1;
}

function veliaChestStore(invIndex, n) {
  const s = INV[invIndex]; if (!s) return false;
  const take = Math.min(n, s.qty || 1);
  if (s.stackable) {
    const slot = VELIA_CHEST.slice(0, VELIA_CHEST_OPEN).findIndex(c => c && c.key === s.key && c.qty < MAX_STACK);
    if (slot !== -1) { VELIA_CHEST[slot].qty += take; invRemoveAt(invIndex, take); refreshInvUI(); renderVeliaChest(); return true; }
  }
  const free = veliaChestFreeSlot();
  if (free === -1) return false;
  VELIA_CHEST[free] = { ...s, qty: take };
  invRemoveAt(invIndex, take);
  refreshInvUI(); renderVeliaChest();
  return true;
}

let chestZoomed = false;
function updateChestZoomBtn() {
  const btn = $('btnChestZoom'); if (!btn) return;
  btn.textContent = chestZoomed
    ? (LANG==='fr' ? '🔎 Réduire (8/ligne)' : '🔎 Shrink (8/row)')
    : (LANG==='fr' ? '🔍 Agrandir (5/ligne)' : '🔍 Enlarge (5/row)');
}
function renderVeliaChest() {
  const grid = $('veliaChestGrid'); if (!grid) return;
  grid.classList.toggle('chestZoomed', chestZoomed);
  updateChestZoomBtn();
  grid.innerHTML = '';
  for (let i = 0; i < INV_SIZE; i++) {
    const locked = i >= VELIA_CHEST_OPEN;
    const s = VELIA_CHEST[i];
    const cell = document.createElement('div');
    cell.className = 'cell' + (s ? ' has k-'+s.kind : '') + (locked ? ' locked' : '');
    if (locked) {
      
      cell.innerHTML = `<span class="zoneTierLock">🔒</span>`;
      cell.style.opacity = '.4'; cell.style.cursor = 'not-allowed';
    } else if (s) {
      cell.innerHTML = `<span style="color:${s.color}">${s.icon || '❔'}</span>` +
        (s.qty > 1 ? `<span class="qty">${fmt(s.qty)}</span>` : '') +
        `<button class="compBagReturnBtn" data-i="${i}" title="${LANG==='fr'?'Renvoyer au sac principal':'Send back to main bag'}">↩️</button>`;
      if (s.color) { cell.style.borderColor = s.color; cell.style.boxShadow = `inset 0 0 6px ${s.color}55`; }
      cell.onmouseenter = ev => { lastMouseX = ev.clientX; lastMouseY = ev.clientY; showItemTooltip(ev.clientX, ev.clientY, s); };
      cell.onmousemove  = ev => { lastMouseX = ev.clientX; lastMouseY = ev.clientY; moveItemTooltip(ev.clientX, ev.clientY); };
      cell.onmouseleave = () => hideItemTooltip();
    }
    grid.appendChild(cell);
  }
  grid.querySelectorAll('.compBagReturnBtn').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      const i = parseInt(btn.dataset.i, 10);
      const it = VELIA_CHEST[i]; if (!it) return;
      if (invAdd({ ...it })) { VELIA_CHEST[i] = null; renderVeliaChest(); refreshInvUI(); }
      else floatTxt(P.x, P.y, 100, LANG==='fr'?'Sac principal plein':'Main bag full', { hurt:true });
    };
  });
  const used = VELIA_CHEST.filter(Boolean).length;
  const summary = $('veliaChestSummary');
  if (summary) summary.textContent = `${used} / ${VELIA_CHEST_OPEN}`;
}

document.querySelectorAll('#lootPanelTabs .lootPanelTab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('#lootPanelTabs .lootPanelTab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const panel = btn.dataset.panel;
    $('lootPanelLootPane').style.display = panel === 'loot' ? '' : 'none';
    $('lootPanelChestPane').style.display = panel === 'chest' ? '' : 'none';
    if (panel === 'chest') renderVeliaChest();
  };
});
$('btnChestZoom').onclick = () => { chestZoomed = !chestZoomed; renderVeliaChest(); };

function quickAction(i) {
  const s = INV[i]; if (!s) return;
  if (s.kind === 'jackpot' || s.kind === 'gear') equipItem(i);
  else if (s.kind === 'material') { forcedMatKey = s.key; refreshInvUI(); }
  else if (s.kind === 'trash') sellOne(i);
  refreshInvUI();
}

function equippedRefForItem(item) {
  if (item.kind === 'gear') return EQUIP[item.slot];
  if (item.kind === 'jackpot') {
    const accSlot = accSlotFor(item);
    if (accSlot === 'ring') return itemScore(EQUIP.ring1) <= itemScore(EQUIP.ring2) ? EQUIP.ring1 : EQUIP.ring2;
    if (accSlot === 'earring') return itemScore(EQUIP.earring1) <= itemScore(EQUIP.earring2) ? EQUIP.earring1 : EQUIP.earring2;
    return EQUIP[accSlot];
  }
  return null;
}

function statDeltaHtml(item) {
  const ref = equippedRefForItem(item);
  const cur = effectiveApDp(item);
  const refStats = ref ? effectiveApDp(ref) : { ap:0, dp:0, hp:0, dodge:0 };
  const parts = [];
  const d = (label, a, b, dec) => {
    const delta = dec ? Math.round((a - b)*10)/10 : Math.round(a - b);
    if (!delta) return;
    parts.push(`<span class="${delta>0?'statGain':'statLoss'}">${delta>0?'+':''}${delta} ${label}</span>`);
  };
  d('PA', cur.ap, refStats.ap); d('PD', cur.dp, refStats.dp); d('PV', cur.hp, refStats.hp);
  d('% Esq.', cur.dodge, refStats.dodge, true);
  if (!parts.length) return '';
  return `<div class="ipDelta">${ref ? (LANG==='fr'?'vs équipé : ':'vs equipped: ') : (LANG==='fr'?'rien d\'équipé — ':'nothing equipped — ')}${parts.join(' ')}</div>`;
}

function statDeltaShortText(item) {
  const ref = equippedRefForItem(item);
  const cur = effectiveApDp(item);
  const refStats = ref ? effectiveApDp(ref) : { ap:0, dp:0, hp:0, dodge:0 };
  const parts = [];
  const d = (label, a, b, dec) => { const v = dec ? Math.round((a-b)*10)/10 : Math.round(a-b); if (v) parts.push((v>0?'+':'')+v+' '+label); };
  d('PA', cur.ap, refStats.ap); d('PD', cur.dp, refStats.dp); d('PV', cur.hp, refStats.hp);
  d('% Esq.', cur.dodge, refStats.dodge, true);
  return parts.length ? ' (' + parts.join(' ') + ')' : '';
}

function showItemMenu(px, py, data) {
  const pop = $('itemPop');
  let html = `<div class="ipName ${data.kind||''}">${tr(data.name)}</div>`;
  const desc = [];
  if (data.kind === 'trash') desc.push('Butin de vente. Valeur unitaire ~'+fmt(data.val)+' silver.');
  if (data.kind === 'material') desc.push('Matériau d\'optimisation. Utilisé automatiquement par le cadre Optimisation.');
  if (data.kind === 'jackpot') { const {ap,dp} = effectiveApDp(data); desc.push('Accessoire — '+(ap?('+'+ap+' PA'):'')+(dp?(' +'+dp+' PD'):'')); }
  if (data.kind === 'gear') { const {ap,dp,hp,dodge} = effectiveApDp(data); desc.push((data.slot==='weapon'?'Arme':'Armure')+' — '+(ap?('+'+ap+' PA '):'')+(dp?('+'+dp+' PD '):'')+(hp?('+'+hp+' PV '):'')+(dodge?('+'+dodge+'% Esq.'):'')+(data.optimizable?' · optimisable':'')); }
  if (data.kind === 'craft') desc.push('Composant de craft endgame. À conserver.');
  if (data.equipped) desc.push('Actuellement équipé' + (data.optimizable ? ' — niveau ' + ENH_NAMES[data.enhLv||0] : '') + '.');
  if (data.qty > 1) desc.push('Quantité : '+data.qty);
  const delta = (!data.equipped && (data.kind === 'gear' || data.kind === 'jackpot')) ? statDeltaHtml(data) : '';
  pop.innerHTML = html + `<div class="ipDesc">${desc.join('<br>')}</div>` + delta;

  const L = LANG === 'fr'
    ? { unequip:'Déséquiper', equip:'Équiper', toOpt:'Mettre en optimisation', sell1:n=>'Vendre 1 ('+n+')', sellAll:n=>'Vendre tout ('+n+')', drop:'Jeter',
        confirmSell1:n=>'Vendre 1 objet pour '+n+' silver ?', confirmSellAll:n=>'Vendre tout le tas pour '+n+' silver ?' }
    : { unequip:'Unequip', equip:'Equip', toOpt:'Load into enhancement', sell1:n=>'Sell 1 ('+n+')', sellAll:n=>'Sell all ('+n+')', drop:'Drop',
        confirmSell1:n=>'Sell 1 item for '+n+' silver?', confirmSellAll:n=>'Sell the whole stack for '+n+' silver?' };
  if (data.equipped) {
    addPopBtn(pop, L.unequip, () => { unequip(data.slotId); });
    if (data.kind === 'gear' || data.kind === 'jackpot') addPopBtn(pop, L.toOpt, () => { optTarget = { loc:'equip', key:data.slotId }; });
  } else if (data.invIndex != null) {
    const s = INV[data.invIndex];
    if (s.kind === 'jackpot' || s.kind === 'gear') {
      addPopBtn(pop, L.equip, () => { equipItem(data.invIndex); });
      
      addPopBtn(pop, L.toOpt, () => { optTarget = { loc:'inv', key:data.invIndex }; });
    }
    if (s.kind === 'material') addPopBtn(pop, L.toOpt, () => { forcedMatKey = s.key; });
    if (s.kind === 'trash' || s.kind === 'material' || s.kind === 'gear' || s.kind === 'jackpot')
      addPopBtn(pop, L.sell1(fmt(s.val)), () => { if (confirm(L.confirmSell1(fmt(s.val)))) sellOne(data.invIndex); });
    if ((s.kind === 'trash' || s.kind === 'material') && s.qty > 1)
      addPopBtn(pop, L.sellAll(fmt(s.val*s.qty)), () => { if (confirm(L.confirmSellAll(fmt(s.val*s.qty)))) sellStack(data.invIndex); });
    
    addPopBtn(pop, LANG==='fr'?'📦 Ranger au coffre (1)':'📦 Store in chest (1)', () => {
      if (!veliaChestStore(data.invIndex, 1)) floatTxt(P.x, P.y, 100, LANG==='fr'?'Coffre plein':'Chest full', { hurt:true });
    });
    addPopBtn(pop, L.drop, () => { dropItem(data.invIndex); });
  } else if (data.compIndex != null) {
    
    addPopBtn(pop, L.equip, () => { equipFromCompendium(data.compIndex); });
    addPopBtn(pop, L.toOpt, () => { optTarget = { loc:'compendium', key:data.compIndex }; });
  }
  pop.style.display = 'block';
  const r = pop.getBoundingClientRect();
  pop.style.left = Math.min(px, window.innerWidth - r.width - 10) + 'px';
  pop.style.top = Math.min(py, window.innerHeight - r.height - 10) + 'px';
}

function showItemMenuAtCell(cell, data) {
  const r = cell.getBoundingClientRect();
  showItemMenu(r.left, r.bottom + 4, data);
}
function addPopBtn(pop, label, fn) {
  const b = document.createElement('button');
  b.textContent = label;
  b.onclick = e => { e.stopPropagation(); fn(); hideItemPop(); refreshInvUI(); };
  pop.appendChild(b);
}

function addPopBtnHtml(pop, html, fn) {
  const b = document.createElement('button');
  b.innerHTML = html;
  b.onclick = e => { e.stopPropagation(); fn(); hideItemPop(); refreshInvUI(); };
  pop.appendChild(b);
}
function hideItemPop() { $('itemPop').style.display = 'none'; document.querySelectorAll('#zoneList .zRow').forEach(r => r.classList.remove('eqFarmHalo')); }
document.addEventListener('click', () => { hideItemPop(); const ps = $('potSelect'); if (ps) ps.classList.remove('show'); });
document.addEventListener('contextmenu', ev => { if (!ev.target.closest('.cell')) hideItemPop(); });

function itemTooltipHtml(data) {
  const desc = [];
  if (data.kind === 'trash') desc.push('Vente ~'+fmt(data.val)+' silver');
  if (data.kind === 'material') desc.push('Matériau d\'optimisation');
  if (data.kind === 'jackpot') { const {ap,dp} = effectiveApDp(data); desc.push('Accessoire'+(ap?(' · +'+ap+' PA'):'')+(dp?(' · +'+dp+' PD'):'')); }
  if (data.kind === 'gear') { const {ap,dp,hp,dodge} = effectiveApDp(data); desc.push((data.slot==='weapon'?'Arme':'Armure')+(ap?(' · +'+ap+' PA'):'')+(dp?(' · +'+dp+' PD'):'')+(hp?(' · +'+hp+' PV'):'')+(dodge?(' · +'+dodge+'% Esq.'):'')); }
  if ((data.kind === 'gear' || data.kind === 'jackpot') && data.optimizable && data.enhLv) desc.push('enchant '+ENH_NAMES[data.enhLv]);
  if (data.kind === 'craft') desc.push('Composant de craft endgame');
  if (data.qty > 1) desc.push('Quantité : '+data.qty);
  return `<div class="ipName ${data.kind||''}">${tr(data.name)}</div><div class="ipDesc">${desc.join(' · ')}</div>`;
}
function showItemTooltip(px, py, data) {
  const tip = $('itemTooltip');
  tip.innerHTML = itemTooltipHtml(data);
  tip.style.display = 'block';
  moveItemTooltip(px, py);
}
function moveItemTooltip(px, py) {
  const tip = $('itemTooltip');
  if (tip.style.display !== 'block') return;
  const r = tip.getBoundingClientRect();
  tip.style.left = Math.min(px+14, window.innerWidth - r.width - 10) + 'px';
  tip.style.top = Math.min(py+14, window.innerHeight - r.height - 10) + 'px';
}
function hideItemTooltip() { $('itemTooltip').style.display = 'none'; }

function resolveEquipSlot(item) {
  if (item.kind === 'gear') return item.slot; 
  if (item.kind === 'jackpot') {
    return item.slot === 'ring' ? (EQUIP.ring1 ? (EQUIP.ring2 ? 'ring1' : 'ring2') : 'ring1')
         : item.slot === 'earring' ? (EQUIP.earring1 ? (EQUIP.earring2 ? 'earring1' : 'earring2') : 'earring1')
         : item.slot === 'necklace' ? 'necklace' : item.slot === 'belt' ? 'belt' : 'ring1';
  }
  return null;
}

function isStrictlyBetterGear(a, b) {
  const sa = itemScore(a), sb = itemScore(b);
  if (sa !== sb) return sa > sb;
  return (a ? (a.enhLv||0) : -1) > (b ? (b.enhLv||0) : -1);
}
function tryAutoEquipIfBetter(i, s) {
  if (s.kind !== 'gear' && s.kind !== 'jackpot') return false;
  
  const base = s.slot;
  if (base === 'ring' || base === 'earring') {
    const slotA = base+'1', slotB = base+'2';
    
    const worseSlot = isStrictlyBetterGear(EQUIP[slotA], EQUIP[slotB]) ? slotB : slotA;
    if (!isStrictlyBetterGear(s, EQUIP[worseSlot])) return false;
    const old = EQUIP[worseSlot];
    if (old && !invAdd({ ...old, equipped:false, qty:1, stackable:false })) return false; 
    EQUIP[worseSlot] = { ...s };
    INV[i] = null;
    return true;
  }
  if (!isStrictlyBetterGear(s, EQUIP[base])) return false;
  equipItem(i);
  return true;
}

function equipItem(i) {
  const item = INV[i]; if (!item) return;
  const slotId = resolveEquipSlot(item);
  if (!slotId) return;
  
  if (EQUIP[slotId]) {
    const old = EQUIP[slotId];
    if (!invAdd({ ...old, equipped:false, qty:1, stackable:false })) return; 
  }
  EQUIP[slotId] = { ...item };
  INV[i] = null;
  hud();
}

function equipFromCompendium(i) {
  const item = COMPENDIUM_BAG[i]; if (!item) return;
  const slotId = resolveEquipSlot(item);
  if (!slotId) return;
  if (EQUIP[slotId]) {
    const old = EQUIP[slotId];
    if (!invAdd({ ...old, equipped:false, qty:1, stackable:false })) return; 
  }
  EQUIP[slotId] = { ...item };
  COMPENDIUM_BAG[i] = null;
  optTarget = { loc:'equip', key:slotId };
  hud();
  renderCompendiumPane();
  renderOptimization();
}
function unequip(slotId) {
  const e = EQUIP[slotId]; if (!e) return;
  if (invAdd({ ...e, equipped:false, qty:1, stackable:false })) { EQUIP[slotId] = null; hud(); }
}

function itemScore(it) { return it ? (it.ap||0) + (it.dp||0)*0.5 + (it.dodge||0)*3 : -1; }

function equipBestSingle(slotId, kind) {
  const current = EQUIP[slotId];
  let best = null, bestIdx = -1;
  let bestScore = itemScore(current), bestEnh = current ? (current.enhLv||0) : -1;
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i];
    if (!it || it.kind !== kind) continue;
    const itSlot = kind === 'gear' ? it.slot : accSlotFor(it);
    if (itSlot !== slotId) continue;
    const sc = itemScore(it);
    const enh = it.enhLv || 0;
    
    if (sc > bestScore || (sc === bestScore && enh > bestEnh)) { bestScore = sc; bestEnh = enh; best = it; bestIdx = i; }
  }
  if (!best) return false;
  if (current && !invAdd({ ...current, equipped:false, qty:1, stackable:false })) return false; 
  EQUIP[slotId] = { ...best };
  INV[bestIdx] = null;
  return true;
}
function equipBestPair(slotA, slotB, accSlot) {
  const candidates = [];
  if (EQUIP[slotA]) candidates.push(EQUIP[slotA]);
  if (EQUIP[slotB]) candidates.push(EQUIP[slotB]);
  const invIdxOf = new Map();
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i];
    if (it && it.kind === 'jackpot' && accSlotFor(it) === accSlot) { candidates.push(it); invIdxOf.set(it, i); }
  }
  
  candidates.sort((a,b) => (itemScore(b) - itemScore(a)) || ((b.enhLv||0) - (a.enhLv||0)));
  const chosen = candidates.slice(0, 2);
  const before = [EQUIP[slotA], EQUIP[slotB]].filter(Boolean);
  const changed = before.length !== chosen.length || before.some(it => !chosen.includes(it));
  if (!changed) return false;
  const toReturn = before.filter(it => !chosen.includes(it));
  for (const it of chosen) { const idx = invIdxOf.get(it); if (idx !== undefined) INV[idx] = null; }
  for (const it of toReturn) invAdd({ ...it, equipped:false, qty:1, stackable:false });
  EQUIP[slotA] = chosen[0] ? { ...chosen[0] } : null;
  EQUIP[slotB] = chosen[1] ? { ...chosen[1] } : null;
  return true;
}
function equipBestGear() {
  let changed = 0;
  for (const slotId of ['weapon','awakening','secondary','helmet','armor','gloves','boots'])
    if (equipBestSingle(slotId, 'gear')) changed++;
  for (const slotId of ['necklace','belt'])
    if (equipBestSingle(slotId, 'jackpot')) changed++;
  if (equipBestPair('ring1','ring2','ring')) changed++;
  if (equipBestPair('earring1','earring2','earring')) changed++;
  hud();
  return changed;
}
$('btnEquipBest').onclick = () => {
  const n = equipBestGear();
  const msg = $('equipBestMsg');
  if (msg) {
    msg.textContent = n > 0
      ? (LANG==='fr' ? `${n} pièce${n>1?'s':''} remplacée${n>1?'s':''} (meilleur socle)` : `${n} piece${n>1?'s':''} swapped (better base stats)`)
      : (LANG==='fr' ? 'Déjà optimal — rien à changer' : 'Already optimal — nothing to change');
    msg.className = n > 0 ? 'ok' : '';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};

function refScoreForSlot(slotId, accSlot) {
  if (accSlot === 'ring') return Math.min(itemScore(EQUIP.ring1), itemScore(EQUIP.ring2));
  if (accSlot === 'earring') return Math.min(itemScore(EQUIP.earring1), itemScore(EQUIP.earring2));
  return itemScore(EQUIP[slotId]);
}

const NEGLECTED_UPGRADE_DELAY_MS = 15000;
function hasNeglectedUpgradeInBag() {
  const now = Date.now();
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i]; if (!it) continue;
    if (it.kind !== 'gear' && it.kind !== 'jackpot') continue;
    if (now - (it.pickedAt || 0) < NEGLECTED_UPGRADE_DELAY_MS) continue;
    const slotId = it.kind === 'gear' ? it.slot : accSlotFor(it);
    const accSlot = it.kind === 'jackpot' ? accSlotFor(it) : null;
    const ref = refScoreForSlot(slotId, accSlot);
    if (itemScore(it) > ref) return true;
  }
  return false;
}

let lastWorseSaleSold = null;
function sellWorseThanEquipped() {
  let count = 0, total = 0, divertedCount = 0;
  const sold = [];
  for (let i = 0; i < INV_SIZE; i++) {
    const it = INV[i]; if (!it) continue;
    if (it.kind !== 'gear' && it.kind !== 'jackpot') continue;
    const slotId = it.kind === 'gear' ? it.slot : accSlotFor(it);
    const accSlot = it.kind === 'jackpot' ? accSlotFor(it) : null;
    const ref = refScoreForSlot(slotId, accSlot);
    if (ref < 0) continue; 
    if (itemScore(it) <= ref) {
      
      if (!S.penMastery[it.name] && !compendiumBagHasName(it.name) && compendiumBagAdd(it)) {
        divertedCount++; INV[i] = null; count++;
      } else {
        total += it.val * it.qty; sold.push({ ...it }); INV[i] = null; count++;
      }
    }
  }
  if (count > 0) { addSilver(total, 'sell', 'Vendre l\'inférieur'); lastWorseSaleSold = sold; hud(); }
  return { count, total, divertedCount };
}

function buyBackLastWorseSale() {
  if (!lastWorseSaleSold || !lastWorseSaleSold.length) return false;
  const total = lastWorseSaleSold.reduce((a,it) => a + it.val*it.qty, 0);
  const freeSlots = INV.filter(s => s === null).length;
  if (freeSlots < lastWorseSaleSold.length || S.silver < total) return false;
  
  S.silver -= total; S.silverEarned -= total;
  if (typeof queueSilverLedger === 'function') queueSilverLedger(-total, 'undo_sell', 'Racheter');
  lastWorseSaleSold.forEach(it => invAdd({ ...it }));
  lastWorseSaleSold = null;
  hud();
  return true;
}
$('btnSellWorse').onclick = () => {
  const { count, total, divertedCount } = sellWorseThanEquipped();
  
  $('btnBuyBackWorse').disabled = !lastWorseSaleSold || !lastWorseSaleSold.length;
  const msg = $('equipBestMsg');
  if (msg) {
    const soldCount = count - divertedCount;
    const divertedTxt = divertedCount > 0
      ? (LANG==='fr' ? ` · +${divertedCount} protégé${divertedCount>1?'s':''} dans le sac 📖 Compendium` : ` · +${divertedCount} protected in the 📖 Compendium bag`)
      : '';
    msg.textContent = count > 0
      ? (LANG==='fr' ? `${soldCount} objet${soldCount>1?'s':''} vendu${soldCount>1?'s':''} (+${fmt(total)} silver)${divertedTxt}` : `${soldCount} item${soldCount>1?'s':''} sold (+${fmt(total)} silver)${divertedTxt}`)
      : (LANG==='fr' ? 'Rien à vendre — tout est déjà au-dessus de l\'équipé' : 'Nothing to sell — everything already beats what\'s equipped');
    msg.className = count > 0 ? 'ok' : '';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};
$('btnBuyBackWorse').onclick = () => {
  const ok = buyBackLastWorseSale();
  $('btnBuyBackWorse').disabled = true;
  const msg = $('equipBestMsg');
  if (msg) {
    msg.textContent = ok
      ? (LANG==='fr' ? 'Objets rachetés ✓' : 'Items bought back ✓')
      : (LANG==='fr' ? 'Rien à racheter (ou sac plein / silver insuffisant)' : 'Nothing to buy back (or bag full / not enough silver)');
    msg.className = ok ? 'ok' : '';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};

function enhanceWithMaterial(i) {
  
  const mat = INV[i]; if (!mat || !EQUIP.weapon || EQUIP.weapon.enhLv >= ENH_NAMES.length-1) return;
  invRemoveAt(i, 1);
  const lvl = EQUIP.weapon.enhLv, target = EQUIP.weapon;
  const chance = enhChance(lvl+1, target);
  const success = Math.random() < chance;
  if (success) {
    target.enhLv++;
    floatTxt(P.x,P.y,100,'✦ '+ENH_NAMES[target.enhLv],{gold:true});
  } else {
    addItemFailstack(target, lvl+1);
    if (lvl >= SAFE_IDX && lvl < PRI_IDX) { 
      target.enhLv = Math.max(SAFE_IDX-1, lvl-1);
      floatTxt(P.x,P.y,100,'✖ rétrogradé — '+ENH_NAMES[target.enhLv],{hurt:true});
    } else if (lvl >= PRI_IDX) { 
      target.enhLv = Math.max(PRI_IDX, lvl-1);
      floatTxt(P.x,P.y,100,'✖ rétrogradé — '+ENH_NAMES[target.enhLv],{hurt:true});
    } else floatTxt(P.x,P.y,100,'✖ échec',{hurt:true});
  }
  renderEquipment(); refreshStatsOnly(); renderOptimization();
}

let optTarget = { loc:'equip', key:'weapon' };
function getOptTargetItem() {
  if (optTarget.loc === 'equip') return EQUIP[optTarget.key];
  if (optTarget.loc === 'inv') return INV[optTarget.key];
  if (optTarget.loc === 'compendium') return COMPENDIUM_BAG[optTarget.key];
  return null;
}
let forcedMatKey = null; 

function optimizableList() { return OPTIMIZABLE_SLOTS.filter(k => EQUIP[k]); }

function findEnhanceMaterial() {
  const target = getOptTargetItem();
  const wantedName = (target && target.matName) || Z().loot.mat.name;
  if (forcedMatKey) {
    const idx = INV.findIndex(s => s && s.key === forcedMatKey);
    
    if (idx !== -1 && INV[idx].name === wantedName) return idx;
    forcedMatKey = null; 
  }
  return INV.findIndex(s => s && s.kind === 'material' && s.name === wantedName);
}
function findCronStone() { return INV.findIndex(s => s && s.name === CRON_STONE.name); }
function renderOptimization() {
  
  const avail = optimizableList();
  
  if (!getOptTargetItem()) optTarget = { loc:'equip', key: avail[0] || 'weapon' };
  const sel = $('optTarget');
  sel.innerHTML = avail.map(k => `<option value="${k}" ${(optTarget.loc==='equip'&&k===optTarget.key)?'selected':''}>${SLOT_LABEL[k]} — ${tr(EQUIP[k].name)} (${ENH_NAMES[EQUIP[k].enhLv||0]})</option>`).join('');

  const target = getOptTargetItem();
  const lvl = target ? (target.enhLv||0) : 0, maxed = lvl >= ENH_NAMES.length-1;
  const parts = target && !maxed ? enhChanceParts(lvl+1, target) : { base:0, bonus:0, total:0 };
  const fsCount = target ? itemFailstack(target, lvl+1) : 0;
  $('optItem').innerHTML = target ? (target.icon || (optTarget.loc==='equip' ? SLOT_ICON[optTarget.key] : '❔')) : '—';
  $('optItem').style.boxShadow = (target && target.color) ? `0 0 8px 2px ${target.color}66` : '';
  $('optLevelLbl').innerHTML = (target ? tr(target.name) : (LANG==='fr'?'Aucune pièce équipée':'No piece equipped')) + ' <b id="optLevelVal">' + (target ? ENH_NAMES[lvl] : '—') + '</b>';

  const matIdx = findEnhanceMaterial(), matSlotEl = $('optMat');
  const maxedTxt = LANG==='fr' ? 'PEN atteint — niveau maximum' : 'PEN reached — max level';
  if (!target) { matSlotEl.className='empty'; matSlotEl.innerHTML='＋'; matSlotEl.style.boxShadow=''; $('optChanceTxt').textContent = LANG==='fr'?'Équipez une pièce à optimiser':'Equip a piece to enhance'; $('btnOpt').disabled=true; }
  else if (matIdx === -1) {
    matSlotEl.className = 'empty'; matSlotEl.innerHTML = '＋'; matSlotEl.title = ''; matSlotEl.style.boxShadow = '';
    $('optChanceTxt').textContent = maxed ? maxedTxt : (LANG==='fr'?'Aucun matériau en sac — farmez du loot':'No material in bag — go loot some');
    $('btnOpt').disabled = true;
  } else {
    const it = INV[matIdx];
    matSlotEl.className = ''; matSlotEl.title = it.name;
    matSlotEl.innerHTML = `<span style="color:${it.color}">${it.icon}</span>` + (it.qty>1?`<span class="matQty">${fmt(it.qty)}</span>`:'');
    matSlotEl.style.boxShadow = it.color ? `0 0 8px 2px ${it.color}66` : '';
    $('btnOpt').disabled = maxed;
    const fsTxt = fsCount > 0 ? ` <span style="color:#8fc9e8">(+${fsCount} ${LANG==='fr'?'échecs sur ce palier':'fails on this tier'})</span>` : '';
    $('optChanceTxt').innerHTML = maxed ? maxedTxt
      : `${LANG==='fr'?'Matériau':'Material'} : ${tr(it.name)} · ${LANG==='fr'?'Chance':'Chance'} : ${(parts.total*100).toFixed(1)}% → ${ENH_NAMES[lvl+1]}${fsTxt}`;
  }
  
  $('optChanceFill').style.width = (parts.base*100)+'%';
  $('optChanceFillFS').style.width = (parts.bonus*100)+'%';
  
  const cronIdx = findCronStone(), cronSlotEl = $('optCronSlot');
  $('optCronIcon').innerHTML = CRON_STONE.icon;
  const cronOffCls = S.useCronStone ? '' : ' off';
  
  const cronCost = cronStoneCostForItem(target);
  const cronHave = cronIdx === -1 ? 0 : INV[cronIdx].qty;
  if (cronIdx === -1) {
    cronSlotEl.className = 'empty' + cronOffCls; cronSlotEl.title = LANG==='fr'?'Aucune Pierre de Cron en sac':'No Cron Stone in bag';
    $('optCronQty').textContent = target ? `0/${cronCost}` : '';
    cronSlotEl.style.boxShadow = '';
  } else {
    cronSlotEl.className = cronOffCls.trim(); cronSlotEl.title = CRON_STONE.name + ' — ' +
      (S.useCronStone ? (LANG==='fr'?'utilisée (clique pour désactiver)':'in use (click to disable)')
                      : (LANG==='fr'?'non utilisée (clique pour activer)':'not used (click to enable)')) +
      (target ? (LANG==='fr'?` · coût pour cette pièce : ${cronCost}`:` · cost for this piece: ${cronCost}`) : '');
    $('optCronQty').innerHTML = target
      ? `<span class="${cronHave >= cronCost ? '' : 'bad'}">${fmt(cronHave)}/${cronCost}</span>`
      : fmt(cronHave);
    cronSlotEl.style.boxShadow = S.useCronStone ? `0 0 8px 2px ${CRON_STONE.color}66` : '';
  }
  renderOptSuggestions();
  if (!autoOptTimer) renderOptAutoTargetSelect(); 
  renderCapConvertRow();
}
$('optTarget').onchange = e => { optTarget = { loc:'equip', key:e.target.value }; stopAutoOpt(); renderOptimization(); };

$('optCronSlot').onclick = () => { S.useCronStone = !S.useCronStone; renderOptimization(); };

function attemptEnhance() {
  const target = getOptTargetItem();
  const idx = findEnhanceMaterial();
  if (!target || idx === -1 || (target.enhLv||0) >= ENH_NAMES.length-1) return false;
  invRemoveAt(idx, 1);
  S.enhAttempts = (S.enhAttempts||0) + 1;
  const lvl = target.enhLv||0;
  const chance = enhChance(lvl+1, target);
  const r = $('optResult');
  if (Math.random() < chance) {
    target.enhLv = lvl+1;
    S.enhSuccess = (S.enhSuccess||0) + 1;
    
    r.textContent = (LANG==='fr'?'✦ SUCCÈS — ':'✦ SUCCESS — ') + ENH_NAMES[target.enhLv]; r.className = 'ok';
    floatTxt(P.x,P.y,100,'✦ '+ENH_NAMES[target.enhLv],{gold:true});
    
    trackEnhPeak(target.name, target.enhLv);
    
    if (target.enhLv >= ENH_NAMES.length-1) {
      markPenMastery(target.name);
      
      evictMasteredFromCompendiumBag(target.name);
    }
  } else {
    addItemFailstack(target, lvl+1); 
    
    const wouldDowngrade = lvl >= SAFE_IDX;
    
    const cronCost = cronStoneCostForItem(target);
    const cronIdxRaw = (wouldDowngrade && S.useCronStone) ? findCronStone() : -1;
    const cronIdx = (cronIdxRaw !== -1 && INV[cronIdxRaw].qty >= cronCost) ? cronIdxRaw : -1;
    if (cronIdx !== -1) {
      invRemoveAt(cronIdx, cronCost);
      r.textContent = (LANG==='fr'?'✖ ÉCHEC — protégé par '+cronCost+' Pierre'+(cronCost>1?'s':'')+' de Cron (':'✖ FAIL — protected by '+cronCost+' Cron Stone'+(cronCost>1?'s':'')+' (')+ENH_NAMES[target.enhLv]+')';
      floatTxt(P.x,P.y,100,LANG==='fr'?'⏳ Protégé !':'⏳ Protected!',{blue:true});
    } else if (lvl >= SAFE_IDX && lvl < PRI_IDX) { 
      target.enhLv = Math.max(SAFE_IDX-1, lvl-1);
      r.textContent = (LANG==='fr'?'✖ ÉCHEC — rétrogradé à ':'✖ FAIL — downgraded to ') + ENH_NAMES[target.enhLv];
    } else if (lvl >= PRI_IDX) { 
      target.enhLv = Math.max(PRI_IDX, lvl-1);
      r.textContent = (LANG==='fr'?'✖ ÉCHEC — rétrogradé à ':'✖ FAIL — downgraded to ') + ENH_NAMES[target.enhLv];
    } else {
      r.textContent = LANG==='fr' ? '✖ ÉCHEC — matériau perdu' : '✖ FAIL — material lost';
    }
    r.className = 'fail';
    
    const card = $('optCard'); card.classList.remove('optShake');
    requestAnimationFrame(() => card.classList.add('optShake'));
  }
  
  if (optTarget.loc === 'equip') {
    refreshEquipSlot(optTarget.key);
    if (optTarget.key === 'weapon') drawPreviewChar(); 
  } else if (optTarget.loc === 'inv') {
    renderInventory();
  } else if (optTarget.loc === 'compendium') {
    renderCompendiumPane();
  }
  $('stWeaponBonus').textContent = '+' + Math.round(enhBonus(EQUIP.weapon ? EQUIP.weapon.enhLv : 0) * 100) + '%';
  $('stArmorBonus').textContent = '+' + Math.round(armorBonusAvg() * 100) + '%';
  refreshStatsOnly(); renderOptimization();
  return true;
}
$('btnOpt').onclick = attemptEnhance;

function optAutoGainParts(target, targetLvl) {
  if (!target || !Number.isInteger(targetLvl)) return [];
  const cur = effectiveApDp(target), proj = projectedApDp(target, targetLvl);
  const parts = [];
  if (proj.ap > cur.ap) parts.push('+' + (proj.ap-cur.ap) + ' PA');
  if (proj.dp > cur.dp) parts.push('+' + (proj.dp-cur.dp) + ' PD');
  if (proj.hp > cur.hp) parts.push('+' + (proj.hp-cur.hp) + ' PV');
  if (proj.dodge > cur.dodge) parts.push('+' + (proj.dodge-cur.dodge).toFixed(2) + '% ' + (LANG==='fr'?'Esq.':'Dodge'));
  return parts;
}

function targetPrimaryStat(target) {
  if (!target) return 'dp';
  if (target.kind === 'jackpot') return 'ap';
  return WEAPON_SLOTS.includes(target.slot) ? 'ap' : 'dp';
}
function optAutoGainPrimaryPart(target, targetLvl) {
  if (!target || !Number.isInteger(targetLvl)) return '';
  const cur = effectiveApDp(target), proj = projectedApDp(target, targetLvl);
  const primary = targetPrimaryStat(target);
  const delta = proj[primary] - cur[primary];
  return delta > 0 ? '+' + delta + ' ' + (primary === 'ap' ? 'PA' : 'PD') : '';
}
function renderOptAutoTargetSelect() {
  const sel = $('optAutoTarget'); if (!sel) return;
  const prevVal = sel.value; 
  const target = getOptTargetItem();
  const curLvl = target ? (target.enhLv||0) : 0;
  const options = ENH_NAMES.map((name,i) => i).filter(i => i > curLvl);
  
  let lastGainTxt = null;
  sel.innerHTML = options.map(i => {
    const gainTxt = optAutoGainPrimaryPart(target, i);
    const showGain = gainTxt !== lastGainTxt;
    if (gainTxt) lastGainTxt = gainTxt;
    return `<option value="${i}">${ENH_NAMES[i]}${(showGain && gainTxt) ? ' (' + gainTxt + ')' : ''}</option>`;
  }).join('') || `<option value="">${LANG==='fr'?'Niveau max atteint':'Max level reached'}</option>`;
  sel.disabled = !options.length;
  
  if (options.some(i => String(i) === prevVal)) sel.value = prevVal;
  renderOptAutoGain();
}

function renderOptAutoGain() {
  const el = $('optAutoGainTxt'); if (!el) return;
  const target = getOptTargetItem();
  const sel = $('optAutoTarget');
  const targetLvl = sel ? parseInt(sel.value, 10) : NaN;
  const parts = optAutoGainParts(target, targetLvl);
  el.textContent = parts.length
    ? (LANG==='fr' ? `À ${ENH_NAMES[targetLvl]} : ` : `At ${ENH_NAMES[targetLvl]}: `) + parts.join(' · ')
    : '';
}
$('optAutoTarget').onchange = renderOptAutoGain;

let autoOptMode = 'target';
function stopAutoOpt() {
  if (autoOptTimer) { clearInterval(autoOptTimer); autoOptTimer = null; }
  autoOptTargetLvl = null;
  const btn = $('btnOptAuto'); if (!btn) return;
  btn.classList.remove('running');
  btn.textContent = LANG==='fr' ? "▶ Auto jusqu'à" : '▶ Auto to';
  $('optAutoTarget').disabled = false;
  $('optAutoMode').disabled = false;
}

$('optAutoMode').onchange = () => {
  $('optAutoTarget').style.display = $('optAutoMode').value === 'target' ? '' : 'none';
};
function startAutoOpt() {
  if (autoOptTimer) { clearInterval(autoOptTimer); autoOptTimer = null; } 
  const mode = $('optAutoMode').value;
  autoOptMode = mode;
  autoOptTargetLvl = null;
  if (mode === 'target') {
    const sel = $('optAutoTarget');
    const lvl = parseInt(sel.value, 10);
    if (!Number.isInteger(lvl)) return;
    autoOptTargetLvl = lvl;
    sel.disabled = true;
  }
  
  let startAp = 0, startDp = 0;
  if (mode === 'nextgain') {
    const target0 = getOptTargetItem();
    if (!target0) return;
    const cur = effectiveApDp(target0);
    startAp = cur.ap; startDp = cur.dp;
  }
  $('optAutoMode').disabled = true;
  const btn = $('btnOptAuto');
  btn.classList.add('running');
  btn.textContent = LANG==='fr' ? '⏸ Arrêter' : '⏸ Stop';
  autoOptTimer = setInterval(() => {
    const target = getOptTargetItem();
    if (!target) { stopAutoOpt(); return; }
    if (mode === 'target' && (target.enhLv||0) >= autoOptTargetLvl) { stopAutoOpt(); return; }
    if ((target.enhLv||0) >= ENH_NAMES.length-1) { stopAutoOpt(); return; } 
    if (findEnhanceMaterial() === -1) {
      $('optResult').textContent = LANG==='fr' ? 'Auto arrêté — plus de matériau' : 'Auto stopped — out of material';
      stopAutoOpt();
      return;
    }
    
    if (mode === 'cron' && findCronStone() === -1) {
      $('optResult').textContent = LANG==='fr' ? 'Auto arrêté — plus de Pierre de Cron' : 'Auto stopped — out of Cron Stones';
      stopAutoOpt();
      return;
    }
    const prevLvl = target.enhLv||0;
    attemptEnhance();
    
    if (mode === 'fail') {
      const target2 = getOptTargetItem();
      if (!target2 || (target2.enhLv||0) !== prevLvl + 1) { stopAutoOpt(); return; }
    }
    
    if (mode === 'nextgain') {
      const target3 = getOptTargetItem();
      if (!target3) { stopAutoOpt(); return; }
      const cur = effectiveApDp(target3);
      if (cur.ap > startAp || cur.dp > startDp) {
        $('optResult').textContent = LANG==='fr' ? `Auto arrêté — gain obtenu (${ENH_NAMES[target3.enhLv||0]})` : `Auto stopped — gain reached (${ENH_NAMES[target3.enhLv||0]})`;
        stopAutoOpt();
        return;
      }
    }
    
  }, 220);
}
$('btnOptAuto').onclick = () => { if (autoOptTimer) stopAutoOpt(); else startAutoOpt(); };

const POUSSIERE_NAME = 'Poussière d\'esprit ancien';
const CAPHRAS_NAME = 'Pierre de Caphras';
function poussiereCount() {
  const s = INV.find(x => x && x.kind === 'craft' && x.name === POUSSIERE_NAME);
  return s ? s.qty : 0;
}
function renderCapConvertRow() {
  const lbl = $('capConvertLbl'), btn = $('btnConvertCaphras'); if (!lbl || !btn) return;
  const n = poussiereCount();
  lbl.textContent = (LANG==='fr' ? `${fmt(n)} poussière → ${Math.floor(n/5)} pierre de Caphras` : `${fmt(n)} dust → ${Math.floor(n/5)} Caphras stone`);
  btn.disabled = n < 5;
}
function convertPoussiereToCaphras() {
  const idx = INV.findIndex(s => s && s.kind === 'craft' && s.name === POUSSIERE_NAME);
  if (idx === -1 || INV[idx].qty < 5) return;
  INV[idx].qty -= 5;
  if (INV[idx].qty <= 0) INV[idx] = null;
  const ok = invAdd({ key:'mat_'+CAPHRAS_NAME, name:CAPHRAS_NAME, kind:'material', icon:ICO_MAT_CAPHRAS, color:'#c9a55a', qty:1, stackable:true, weight:0.1, val:120 });
  if (!ok) {
    
    const s = INV[idx];
    if (s) s.qty += 5; else INV[idx] = { key:'craft_'+POUSSIERE_NAME, name:POUSSIERE_NAME, kind:'craft', icon:'✦', color:'#b48ce8', qty:5, stackable:true, weight:0.2, val:0 };
    floatTxt(P.x, P.y, 100, LANG==='fr'?'Sac plein':'Bag full', { hurt:true });
    return;
  }
  floatTxt(P.x, P.y, 100, '+1 '+CAPHRAS_NAME, { gold:true });
  hud();
}
$('btnConvertCaphras').onclick = convertPoussiereToCaphras;

function renderOptSuggestions() {
  const nextZone = ZONES[zoneIdx+1];
  const box = $('optSuggest');
  if (!nextZone) { box.innerHTML = ''; return; }
  const avail = optimizableList();
  if (!avail.length) { box.innerHTML = ''; return; }

  const apDeficit = Math.max(0, nextZone.reqAP - apEff());
  const dpDeficit = Math.max(0, nextZone.reqDP - totalDP());
  
  const focusAP = (apDeficit / nextZone.reqAP) >= (dpDeficit / nextZone.reqDP);

  let best = null, bestGain = -1;
  for (const k of avail) {
    const e = EQUIP[k];
    const lvl = e.enhLv||0;
    if (lvl >= ENH_NAMES.length-1) continue;
    const step = enhBonus(lvl+1) - enhBonus(lvl);
    
    const gain = focusAP ? e.ap*step : (e.dp||0)*step;
    if (gain > bestGain) { bestGain = gain; best = { k, e, lvl }; }
  }
  if (!best || bestGain <= 0) { box.innerHTML = ''; return; }

  const arrow = ENH_NAMES[best.lvl] + '→' + ENH_NAMES[best.lvl+1];
  const lbl = LANG==='fr' ? 'Recommandé' : 'Recommended';
  box.innerHTML = `<div class="optSuggestLbl">${lbl} :</div><div class="optSuggestPick">${tr(best.e.name)} <span class="optSuggestArrow">${arrow}</span></div>`;
}

const LOOT_ICONS = { trash:'▬', material:'◈', jackpot:'💍', craft:'✦', gear:'⚔️' };

function lootAutoSellLockHtml() {
  return `<button class="lootAutoSellBtn" disabled title="${LANG==='fr'?'Vente automatique (bientôt disponible)':'Auto-sell (coming soon)'}"><span class="zoneTierLock">🔒</span>🗑️</button>`;
}

(function initLootIconZoom() {
  const zoomEl = document.getElementById('lootIconZoom');
  if (!zoomEl) return;
  document.addEventListener('mouseover', e => {
    const icon = e.target.closest('.lootIcon');
    if (!icon) return;
    zoomEl.innerHTML = icon.innerHTML;
    const col = icon.style.color; if (col) zoomEl.style.color = col;
    const r = icon.getBoundingClientRect();
    let left = r.right + 10, top = r.top + r.height/2 - 48;
    if (left + 96 > window.innerWidth) left = r.left - 106;
    top = Math.max(6, Math.min(top, window.innerHeight - 102));
    zoomEl.style.left = left + 'px'; zoomEl.style.top = top + 'px';
    zoomEl.classList.add('show');
  });
  document.addEventListener('mouseout', e => {
    const icon = e.target.closest('.lootIcon');
    if (!icon) return;
    if (icon.contains(e.relatedTarget)) return;
    zoomEl.classList.remove('show');
  });
})();

function zoneLootRowsHtml(idx) {
  const z = ZONES[idx], L = z.loot;
  const tier = gearTierForZone(idx);
  const gearCh = gearDropChance(tier, idx);
  const equippedWord = LANG === 'fr' ? 'PA équipé' : 'AP equipped';
  const armorPieceNote = LANG==='fr' ? 'armure — cette zone uniquement' : 'armor — this zone only';
  const weaponPieceNote = LANG==='fr' ? 'arme — cette zone uniquement' : 'weapon — this zone only';
  const rows = [
    { kind:'trash',    it:L.trash,   note:'revenu de base' },
    { kind:'material', it:{name:tier.material.name, icon:tier.material.icon}, ch:L.mat.ch, note:'optimisation' },
  ];
  
  const GEAR_ICON_FOR_SLOT = { helmet:helmetIconForColor, armor:armorIconForColor, gloves:glovesIconForColor, boots:bootsIconForColor,
    weapon:staffIconForColor, secondary:daggerIconForColor, awakening:orbPairIconForColor };
  const armorSlot = (ZONE_ARMOR_SLOTS[idx]||[])[0];
  if (armorSlot) rows.push({ kind:'gear', it:{name:tier.sets[armorSlot], icon:GEAR_ICON_FOR_SLOT[armorSlot](tier.color,tier.grade)}, ch:gearCh, note:armorPieceNote, slot:armorSlot });
  const weaponSlot = (ZONE_WEAPON_SLOTS[idx]||[])[0];
  if (weaponSlot) rows.push({ kind:'gear', it:{name:tier.sets[weaponSlot], icon:GEAR_ICON_FOR_SLOT[weaponSlot](tier.color,tier.grade)}, ch:gearCh, note:weaponPieceNote, slot:weaponSlot });
  const jSlot = accSlotFor(L.jackpot);
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const jackpotIcon = (JEWEL_ICON_FOR_SLOT[jSlot] || ringIconForTier)(jTierIdx, tier.color);
  
  const jackpotApShown = gearFloor((z.gearBasisAP ?? z.reqAP) * GEAR_ROLE.jackpot.apShare);
  rows.push(
    { kind:'jackpot',  it:{...L.jackpot, ch:jewelDropChance(tier, L.jackpot.ch), icon:jackpotIcon}, note:'+'+jackpotApShown+' '+equippedWord, baseSlot:jSlot },
    { kind:'craft',    it:L.craft,   note:'craft endgame' },
    
    { kind:'material', it:{name:CRON_STONE.name, icon:CRON_STONE.icon}, ch:CRON_STONE.ch, note:'1 à 3 unités — protège un enchantement d\'une rétrogradation' },
  );
  
  const upgradedSlots = (idx === zoneIdx && !atVelia) ? slotsUpgradedByZone(idx) : [];
  
  const rowColor = { gear: tier.color, material: tier.material.color, jackpot: tier.color };
  
  const LOOT_CATS = {
    trash:    { fr:'Trashloot', en:'Trash loot', order:0 },
    gear:     { fr:'Équipements', en:'Gear', order:1 },
    jackpot:  { fr:'Équipements', en:'Gear', order:1 },
    material: { fr:'Objets d\'optimisation', en:'Enhancement items', order:2 },
    craft:    { fr:'Objets d\'optimisation', en:'Enhancement items', order:2 },
  };
  const rowsHtml = rows.map(r => {
    const ch = r.ch ?? r.it.ch;
    
    const col = r.it.name === CRON_STONE.name ? CRON_STONE.color : rowColor[r.kind];
    const iconHtml = r.it.icon || LOOT_ICONS[r.kind];
    
    const priceHtml = r.kind === 'trash' ? `<div class="lv">${fmt(r.it.val)} silver</div>` : '';
    
    const isUpgrade = r.slot ? upgradedSlots.includes(r.slot)
      : r.baseSlot ? upgradedSlots.some(s => accBaseSlot(s) === r.baseSlot) : false;
    const upgradeHtml = isUpgrade ? `<span class="lootUpgradeArrow" title="${LANG==='fr'?'Améliore ton stuff actuel':'Upgrades your current gear'}">⬆️</span>` : '';
    return { cat: LOOT_CATS[r.kind] || { fr:'Autre', en:'Other', order:9 }, html: `
    <div class="lootRow${isUpgrade?' lootRowUpgrade':''}">
      ${upgradeHtml}
      <div class="lootIcon k-${r.kind}"${col?` style="color:${col};border-color:${col}"`:''}>${iconHtml}</div>
      <div class="lootInfo"><div class="ln"${col?` style="color:${col}"`:''}>${tr(r.it.name)}</div><div class="lv">${tr(r.note)}</div>${priceHtml}</div>
      <div class="lootPct">${(ch*100).toFixed(ch < .01 ? 3 : 1)}%</div>
      ${lootAutoSellLockHtml()}
    </div>` };
  });
  const catOrder = [...new Set(rowsHtml.map(r => r.cat.order))].sort((a,b) => a-b);
  return catOrder.map(order => {
    const group = rowsHtml.filter(r => r.cat.order === order);
    const label = group[0].cat[LANG];
    return `<div class="lootCatHead">${label}</div>${group.map(r => r.html).join('')}`;
  }).join('');
}

function zoneLootCompactRowHtml(idx) {
  const z = ZONES[idx], tier = gearTierForZone(idx);
  
  const jSlot = accSlotFor(z.loot.jackpot);
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const jackpotIcon = (JEWEL_ICON_FOR_SLOT[jSlot] || ringIconForTier)(jTierIdx, tier.color);
  return `<div class="lootRow lootZoneCompact" data-zi="${idx}">
    <div class="lootIcon k-jackpot" style="color:${tier.color};border-color:${tier.color}">${jackpotIcon}</div>
    <div class="lootInfo"><div class="ln" style="color:${tier.color}">${tr(z.name)}</div><div class="lv">${tr(z.mob)} · ${tr(z.loot.jackpot.name)}</div></div>
    <div class="lootPct">${fmtTinyPct(jewelDropChance(tier, z.loot.jackpot.ch))} <span class="lootExpandHint">▾</span></div>
  </div>`;
}

function showFarmGuide() {
  const rows = ZONES.map((z,zi) => ({ zi, dangerous: badgeOf(bottleneck(z)).txt === 'ZONE DANGEREUSE' }))
    .filter(r => r.zi <= S.maxZoneIdx && !r.dangerous);
  const html = rows.length ? rows.map(r =>
    `${zoneLootCompactRowHtml(r.zi)}<div class="lootZoneDetail" id="farmGuideDetail${r.zi}" style="display:none">${zoneLootRowsHtml(r.zi)}</div>`
  ).join('') : `<div class="admHint">${LANG==='fr'
    ? 'Aucune zone débloquée n\'est actuellement sûre pour toi — améliore ton stuff ou explore prudemment.'
    : 'No unlocked zone is currently safe for you — improve your gear or explore carefully.'}</div>`;
  const banner = `<div class="admHint">${LANG==='fr'
    ? '🗺️ Où farmer ? Zones débloquées, hors zones trop dangereuses pour ton stuff actuel — clique une zone pour voir le détail complet :'
    : '🗺️ Where to farm? Unlocked zones, excluding ones currently too dangerous for your gear — click a zone to see the full detail:'}</div>`;
  openInfo(LANG==='fr' ? '🗺️ Où farmer ?' : '🗺️ Where to farm?', banner + html);
  $a('infoBody').querySelectorAll('.lootZoneCompact').forEach(row => {
    row.onclick = () => {
      const detail = $a('farmGuideDetail'+row.dataset.zi);
      const willOpen = detail.style.display === 'none';
      detail.style.display = willOpen ? '' : 'none';
      row.classList.toggle('expanded', willOpen);
    };
  });
}
function renderLootTable(previewIdx) {
  
  if (atVelia && previewIdx == null) {
    lootPreviewIdx = null;
    updateZoneViewHalo();
    $('lootZoneName').textContent = LANG==='fr' ? 'Velia — zone paisible' : 'Velia — peaceful zone';
    const banner = `<div class="admHint">${LANG==='fr'
      ? '🕊️ Zone paisible : aucun monstre, aucun loot possible ici. Aperçu condensé de ce que chaque zone de Velia peut looter — clique une zone pour voir le détail complet :'
      : '🕊️ Peaceful zone: no monsters, no loot possible here. Condensed preview of what each Velia zone can loot — click a zone to see the full detail:'}</div>`;
    const allZonesHtml = ZONES.map((z,zi) =>
      `${zoneLootCompactRowHtml(zi)}<div class="lootZoneDetail" id="lootDetail${zi}" style="display:none">${zoneLootRowsHtml(zi)}</div>`
    ).join('');
    $('lootTable').innerHTML = banner + allZonesHtml;
    $('lootTable').querySelectorAll('.lootZoneCompact').forEach(row => {
      row.onclick = () => {
        const detail = $a('lootDetail'+row.dataset.zi);
        const willOpen = detail.style.display === 'none';
        detail.style.display = willOpen ? '' : 'none';
        row.classList.toggle('expanded', willOpen);
      };
    });
    return;
  }
  const idx = previewIdx != null ? previewIdx : zoneIdx;
  lootPreviewIdx = previewIdx != null ? previewIdx : null;
  updateZoneViewHalo();
  const z = ZONES[idx];
  const previewTag = previewIdx != null && previewIdx !== zoneIdx
    ? (LANG==='fr' ? '👁 Aperçu — ' : '👁 Preview — ') : '';
  $('lootZoneName').textContent = previewTag + tr(z.mob);
  const mainRowsHtml = zoneLootRowsHtml(idx);
  
  const treasureRowsHtml = VELIA_TREASURE.map(t => `
    <div class="lootRow">
      <div class="lootIcon k-treasure" style="color:${t.color};border-color:${t.color}">${t.icon}</div>
      <div class="lootInfo"><div class="ln" style="color:${t.color}">${tr(t.name)}</div></div>
      <div class="lootPct">${fmtTinyPct(t.ch)}</div>
      ${lootAutoSellLockHtml()}
    </div>`).join('');
  $('lootTable').innerHTML = mainRowsHtml +
    `<div class="lootCatHead">🗺️ ${LANG==='fr'?'Trésor de Velia':'Velia Treasure'}</div>` + treasureRowsHtml;
}
function dropItem(i) {
  const s = INV[i]; if (!s) return;
  if (forcedMatKey && s.key === forcedMatKey) forcedMatKey = null;
  INV[i] = null;
  hud();
}

function sellOne(i) {
  const s = INV[i]; if (!s) return;
  if (s.kind === 'gear' || s.kind === 'jackpot') {
    if (tryAutoEquipIfBetter(i, s)) { hud(); return; }
    if (!S.penMastery[s.name]) {
      ensureCompendiumProtection(s.name);
      if (INV[i] !== s) { hud(); return; } 
    }
  }
  addSilver(s.val, 'sell', s.name);
  if (s.kind === 'gear' || s.kind === 'jackpot') INV[i] = null; else invRemoveAt(i, 1);
  hud();
}
function sellStack(i) {
  const s = INV[i]; if (!s) return;
  const total = s.val * s.qty;
  addSilver(total, 'sell', s.name);
  INV[i] = null;
  if (s.kind === 'gear' || s.kind === 'jackpot') ensureCompendiumProtection(s.name);
  hud();
}

function equipSellCompendium() {
  const equipped = equipBestGear();
  const { count, total, divertedCount } = sellWorseThanEquipped();
  return { equipped, sold: count - divertedCount, total, diverted: divertedCount };
}
$('btnEquipSellCompendium').onclick = () => {
  const { equipped, sold, total, diverted } = equipSellCompendium();
  $('btnBuyBackWorse').disabled = !lastWorseSaleSold || !lastWorseSaleSold.length;
  const msg = $('equipBestMsg');
  if (msg) {
    const parts = [];
    if (equipped > 0) parts.push(LANG==='fr' ? `${equipped} équipée${equipped>1?'s':''}` : `${equipped} equipped`);
    if (sold > 0) parts.push(LANG==='fr' ? `${sold} vendue${sold>1?'s':''} (+${fmt(total)} silver)` : `${sold} sold (+${fmt(total)} silver)`);
    if (diverted > 0) parts.push(LANG==='fr' ? `${diverted} protégée${diverted>1?'s':''} 📖` : `${diverted} protected 📖`);
    msg.textContent = parts.length ? parts.join(' · ') : (LANG==='fr' ? 'Déjà optimal — rien à faire' : 'Already optimal — nothing to do');
    msg.className = parts.length ? 'ok' : '';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};

function refreshInvUI() { renderEquipment(); renderInventory(); renderCompendiumPane(); renderOptimization(); renderLootTable(lootPreviewIdx); }

// ==== src/inventory/gear-migrations.js ====
const GEAR_RESCALE_RATIO_AP = {
  weapon: 0.0896/0.42, awakening: 0.1173/0.55, secondary: 0.0640/0.30,
  helmet: 0.0204/0.05, armor: 0.0204/0.05, gloves: 0.0163/0.04, boots: 0.0163/0.04,
};
const GEAR_RESCALE_RATIO_DP = {
  helmet: 0.1272/0.24, armor: 0.1272/0.24, gloves: 0.0954/0.18, boots: 0.0954/0.18,
};
const JEWELRY_NEW_AP = {
  'Anneau Naru':1, 'Collier Naru':1, 'Ceinture Naru':1,
  'Anneau Tuvala':2, 'Collier Tuvala':3, 'Ceinture Tuvala':4,
  'Anneau Asula':4, 'Collier Asula':7, 'Ceinture Asula':10,
  'Anneau de Cadry':8, "Serap's Necklace":13,
};
function migrateGearRebalanceV158() {
  const rescaleOne = it => {
    if (!it) return;
    if (it.kind === 'gear' && it.slot) {
      const rAp = GEAR_RESCALE_RATIO_AP[it.slot];
      if (rAp != null) it.ap = Math.round((it.ap||0) * rAp);
      const rDp = GEAR_RESCALE_RATIO_DP[it.slot];
      if (rDp != null) it.dp = Math.round((it.dp||0) * rDp);
      
    } else if (it.kind === 'jackpot' && JEWELRY_NEW_AP[it.name] != null) {
      it.ap = JEWELRY_NEW_AP[it.name];
    }
  };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}

const JEWELRY_NEW_AP_V175 = {
  'Anneau Tuvala':1, 'Collier Tuvala':2, 'Ceinture Tuvala':3,
  'Anneau Asula':2, 'Collier Asula':4, 'Ceinture Asula':6,
  'Anneau de Cadry':6, "Serap's Necklace":9, "Orkinrad's Belt":10,
};
function migrateEarringRebalanceV175() {
  const rescaleOne = it => { if (it && it.kind === 'jackpot' && JEWELRY_NEW_AP_V175[it.name] != null) it.ap = JEWELRY_NEW_AP_V175[it.name]; };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}

const GEAR_RESCALE_RATIO_AP_V192 = {
  weapon: 1.271, awakening: 1.271, secondary: 1.271,
  helmet: 0, armor: 0, gloves: 0, boots: 0,
};
function migrateArmorNoApV192() {
  const rescaleOne = it => {
    if (!it || it.kind !== 'gear' || !it.slot) return;
    const r = GEAR_RESCALE_RATIO_AP_V192[it.slot];
    if (r != null) it.ap = Math.round((it.ap||0) * r);
  };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}

const JACKPOT_NAME_TO_ZONE = {
  'Anneau Naru':0, 'Collier Naru':1, 'Ceinture Naru':2,
  'Anneau Tuvala':3, 'Collier Tuvala':4, 'Ceinture Tuvala':5,
  'Anneau Asula':6, 'Collier Asula':7, 'Ceinture Asula':8,
  'Anneau de Cadry':9, "Serap's Necklace":10, "Orkinrad's Belt":11,
  'Boucle Naru':12, 'Boucle Tuvala':13, 'Boucle Asula':14, "Tungrad's Earring":15,
};

function migrateJewelryApV207() {
  const rescaleOne = it => {
    if (!it || it.kind !== 'jackpot') return;
    const zi = JACKPOT_NAME_TO_ZONE[it.name];
    if (zi == null) return;
    const zone = ZONES[zi];
    it.ap = gearFloor((zone.gearBasisAP ?? zone.reqAP) * GEAR_ROLE.jackpot.apShare);
  };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}

function zoneForGearPiece(item) {
  const tierIdx = GEAR_TIERS.findIndex(t => t.color === item.color);
  if (tierIdx === -1) return null;
  const tier = GEAR_TIERS[tierIdx];
  for (const zi of tier.zones) {
    if ((ZONE_ARMOR_SLOTS[zi]||[]).includes(item.slot) || (ZONE_WEAPON_SLOTS[zi]||[]).includes(item.slot)) return zi;
  }
  return null;
}

function migrateGearFixedStatsV226() {
  const rescaleOne = it => {
    if (!it) return;
    if (it.kind === 'gear' && it.slot) {
      const zi = zoneForGearPiece(it);
      if (zi == null) return;
      const zone = ZONES[zi];
      const role = GEAR_ROLE[it.slot];
      const basisAP = zone.gearBasisAP ?? zone.reqAP, basisDP = zone.gearBasisDP ?? zone.reqDP;
      it.ap = role.apShare ? gearFloor(basisAP * role.apShare) : 0;
      it.dp = role.dpShare ? gearFloor(basisDP * role.dpShare) : 0;
      it.hp = role.hpShare ? gearFloor(basisDP * role.hpShare * HP_GEAR_SCALE) : 0;
      it.dodge = Math.round(basisDP * (role.dodgeShare||0) * DODGE_GEAR_SCALE * 100) / 100;
      it.val = Math.round((it.ap*2 + it.dp + it.hp*0.5) * GEAR_SELL_MULT);
    } else if (it.kind === 'jackpot') {
      const zi = JACKPOT_NAME_TO_ZONE[it.name];
      if (zi == null) return;
      it.val = gearFloor(ZONES[zi].loot.trash.val * JACKPOT_VAL_TRASH_RATIO);
    }
  };
  Object.values(EQUIP).forEach(rescaleOne);
  INV.forEach(rescaleOne);
  COMPENDIUM_BAG.forEach(rescaleOne);
}

function migrateGearRescaleV235() {
  migrateGearFixedStatsV226();
  migrateJewelryApV207();
}

function migrateGearRescaleV243() {
  migrateGearFixedStatsV226();
  migrateJewelryApV207();
}

function migrateGearRescaleV245() {
  migrateGearFixedStatsV226();
  migrateJewelryApV207();
}

function migrateJewelryMatNameV239() {
  const fix = it => {
    if (!it || it.kind !== 'jackpot' || it.matName) return;
    const zi = JACKPOT_NAME_TO_ZONE[it.name];
    if (zi == null) return;
    it.matName = gearTierForZone(zi).material.name;
  };
  Object.values(EQUIP).forEach(fix);
  INV.forEach(fix);
  COMPENDIUM_BAG.forEach(fix);
}

function migratePenMasteryV308() {
  const maxLvl = ENH_NAMES.length - 1;
  const check = it => {
    if (!it || !it.optimizable || (it.enhLv||0) < maxLvl) return;
    S.penMastery[it.name] = true;
  };
  Object.values(EQUIP).forEach(check);
  INV.forEach(check);
  COMPENDIUM_BAG.forEach(check);
  
  new Set(COMPENDIUM_BAG.filter(Boolean).map(it => it.name)).forEach(evictMasteredFromCompendiumBag);
}

// ==== src/admin/enh-debug-tools.js ====
function adminMaxEnhAllEquipped() {
  const maxLvl = ENH_NAMES.length - 1;
  let count = 0;
  for (const slotId of Object.keys(EQUIP)) {
    const item = EQUIP[slotId];
    if (item && item.optimizable && (item.enhLv||0) < maxLvl) {
      item.enhLv = maxLvl;
      refreshEquipSlot(slotId);
      count++;
    }
  }
  if (count > 0) { hud(); renderOptimization(); drawPreviewChar(); }
  return count;
}
const adminMaxEnhBtnEl = $('btnAdminMaxEnh');
if (adminMaxEnhBtnEl) adminMaxEnhBtnEl.onclick = () => {
  if (typeof isAdmin === 'function' && !isAdmin()) return; 
  const count = adminMaxEnhAllEquipped();
  const msg = $('equipBestMsg');
  if (msg) {
    msg.textContent = count > 0
      ? (LANG==='fr' ? `${count} pièce${count>1?'s':''} passée${count>1?'s':''} en Optimisation max` : `${count} piece${count>1?'s':''} set to max Enhancement`)
      : (LANG==='fr' ? 'Déjà toutes au maximum' : 'Already all at max');
    msg.className = 'ok';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};

function adminResetEnhAllEquipped() {
  let count = 0;
  for (const slotId of Object.keys(EQUIP)) {
    const item = EQUIP[slotId];
    if (item && item.optimizable && (item.enhLv||0) > 0) {
      item.enhLv = 0;
      refreshEquipSlot(slotId);
      count++;
    }
  }
  if (count > 0) { hud(); renderOptimization(); drawPreviewChar(); }
  return count;
}
const adminResetEnhBtnEl = $('btnAdminResetEnh');
if (adminResetEnhBtnEl) adminResetEnhBtnEl.onclick = () => {
  if (typeof isAdmin === 'function' && !isAdmin()) return;
  const count = adminResetEnhAllEquipped();
  const msg = $('equipBestMsg');
  if (msg) {
    msg.textContent = count > 0
      ? (LANG==='fr' ? `${count} pièce${count>1?'s':''} rétrogradée${count>1?'s':''} à +0` : `${count} piece${count>1?'s':''} reset to +0`)
      : (LANG==='fr' ? 'Déjà toutes à +0' : 'Already all at +0');
    msg.className = 'ok';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};

function adminStepEnhAllEquipped(delta) {
  const maxLvl = ENH_NAMES.length - 1;
  let count = 0;
  for (const slotId of Object.keys(EQUIP)) {
    const item = EQUIP[slotId];
    if (!item || !item.optimizable) continue;
    const cur = item.enhLv||0, next = Math.max(0, Math.min(maxLvl, cur + delta));
    if (next === cur) continue;
    item.enhLv = next;
    refreshEquipSlot(slotId);
    count++;
  }
  if (count > 0) { hud(); renderOptimization(); drawPreviewChar(); }
  return count;
}
function wireAdminEnhStepBtn(id, delta, msgUpFr, msgUpEn, msgNoneFr, msgNoneEn) {
  const el = $(id); if (!el) return;
  el.onclick = () => {
    if (typeof isAdmin === 'function' && !isAdmin()) return;
    const count = adminStepEnhAllEquipped(delta);
    const msg = $('equipBestMsg');
    if (msg) {
      msg.textContent = count > 0
        ? (LANG==='fr' ? `${count} ${msgUpFr}` : `${count} ${msgUpEn}`)
        : (LANG==='fr' ? msgNoneFr : msgNoneEn);
      msg.className = 'ok';
      setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
    }
  };
}
wireAdminEnhStepBtn('btnAdminEnhDown1', -1,
  'pièce(s) rétrogradée(s) d\'1 rang', 'piece(s) downgraded by 1 rank',
  'Déjà toutes à +0', 'Already all at +0');
wireAdminEnhStepBtn('btnAdminEnhUp1', 1,
  'pièce(s) augmentée(s) d\'1 rang', 'piece(s) upgraded by 1 rank',
  'Déjà toutes au maximum', 'Already all at max');

function adminEquipFullTierSet(grade) {
  const tier = GEAR_TIERS.find(t => t.grade === grade);
  if (!tier) return 0;
  const lastZone = ZONES[tier.zones[tier.zones.length-1]];
  const basisAP = lastZone.gearBasisAP ?? lastZone.reqAP, basisDP = lastZone.gearBasisDP ?? lastZone.reqDP;
  const TIER_COLORED_ICON = {
    helmet:helmetIconForColor, armor:armorIconForColor, gloves:glovesIconForColor, boots:bootsIconForColor,
    weapon:staffIconForColor, secondary:daggerIconForColor, awakening:orbPairIconForColor,
  };
  let count = 0;
  for (const slot of ['helmet','armor','gloves','boots','weapon','awakening','secondary']) {
    const role = GEAR_ROLE[slot];
    const ap = role.apShare ? gearFloor(basisAP * role.apShare) : 0;
    const dp = role.dpShare ? gearFloor(basisDP * role.dpShare) : 0;
    const hp = role.hpShare ? gearFloor(basisDP * role.hpShare * HP_GEAR_SCALE) : 0;
    const dodge = Math.round(basisDP * (role.dodgeShare||0) * DODGE_GEAR_SCALE * 100) / 100;
    EQUIP[slot] = {
      name: tier.sets[slot], kind:'gear', slot, ap, dp, hp, dodge, enhLv:0, optimizable:true, fsByLevel:{},
      key:'gear_'+tier.grade+'_'+slot+'_admin'+Math.random().toString(36).slice(2,7),
      icon: TIER_COLORED_ICON[slot](tier.color, tier.grade), color:tier.color, stackable:false, weight:1.2,
      matName: tier.material.name,
      val: Math.round((ap*2 + dp + hp*0.5) * GEAR_SELL_MULT),
    };
    count++;
  }
  const JEWEL_ICON_FOR_SLOT = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier };
  const jTierIdx = JEWEL_TIER_IDX[tier.grade] ?? 0;
  const byBaseSlot = {};
  for (const zi of tier.zones) {
    const z = ZONES[zi], jp = z.loot.jackpot, baseSlot = accSlotFor(jp);
    const zBasisAP = z.gearBasisAP ?? z.reqAP;
    byBaseSlot[baseSlot] = {
      name: jp.name, kind:'jackpot', ap: gearFloor(zBasisAP * GEAR_ROLE.jackpot.apShare), dp:0, hp:0, dodge:0,
      enhLv:0, optimizable:true, fsByLevel:{}, color:tier.color, stackable:false, weight:0.5, matName:tier.material.name,
      icon: (JEWEL_ICON_FOR_SLOT[baseSlot]||ringIconForTier)(jTierIdx, tier.color),
      val: gearFloor(z.loot.trash.val * JACKPOT_VAL_TRASH_RATIO),
    };
  }
  const place = (slot, baseSlot) => {
    const tmpl = byBaseSlot[baseSlot]; if (!tmpl) return;
    EQUIP[slot] = { ...tmpl, key:'acc_'+tier.grade+'_'+slot+'_admin'+Math.random().toString(36).slice(2,7) };
    count++;
  };
  place('ring1','ring'); place('ring2','ring');
  place('earring1','earring'); place('earring2','earring');
  place('necklace','necklace'); place('belt','belt');
  hud(); renderEquipment(); refreshInvUI(); drawPreviewChar();
  return count;
}
const adminEquipTierBtnEl = $('btnAdminEquipTier');
if (adminEquipTierBtnEl) adminEquipTierBtnEl.onclick = () => {
  if (typeof isAdmin === 'function' && !isAdmin()) return; 
  const sel = $('admTierSelect'); if (!sel) return;
  const count = adminEquipFullTierSet(sel.value);
  const msg = $('equipBestMsg');
  if (msg) {
    const tierObj = GEAR_TIERS.find(t => t.grade === sel.value);
    const tierName = tierObj ? tierObj.label[LANG] : sel.value;
    msg.textContent = count > 0
      ? (LANG==='fr' ? `Équipé : set complet ${tierName} (${count} pièces)` : `Equipped: full ${tierName} set (${count} pieces)`)
      : (LANG==='fr' ? 'Palier introuvable' : 'Tier not found');
    msg.className = 'ok';
    setTimeout(() => { if ($('equipBestMsg')) $('equipBestMsg').textContent = ''; }, 3000);
  }
};

// ==== src/world/render.js ====
function hash2(ix,iy){ let h=ix*374761393+iy*668265263; h=(h^(h>>13))*1274126177; return ((h^(h>>>16))>>>0)/4294967295; }

const VELIA_TINT = { a:'#6a5842', b:'#5f4d38', dry:'#7a6650' };
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

function sceneryAt(ix,iy) {
  const h = hash2(ix*7+3, iy*7+11);
  if (h > .965) return { kind:'rock', x:ix*46+23, y:iy*46+23 };
  if (h > .90)  return { kind:'bush', x:ix*46+23, y:iy*46+23 };
  if (h > .78)  return { kind:'tuft', x:ix*46+23, y:iy*46+23 };
  return null;
}

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

function drawEntities(t) {
  const items = [];
  const TILE = 46;
  const cx0 = Math.floor((cam.x-700)/TILE), cx1 = Math.ceil((cam.x+700)/TILE);
  const cy0 = Math.floor((cam.y-700)/TILE), cy1 = Math.ceil((cam.y+700)/TILE);
  for (let ix=cx0; ix<=cx1; ix++)
    for (let iy=cy0; iy<=cy1; iy++) {
      const sc = atVelia ? veliaSceneryAt(ix,iy) : (zoneIdx === 6 ? mineSceneryAt(ix,iy) : sceneryAt(ix,iy));
      
      if (sc) items.push({ depth: sc.kind==='crevasse' ? -1e9 : sc.x+sc.y, fn:()=>drawScenery(sc) });
    }
  corpses.forEach(c => items.push({ depth:c.x+c.y-1, fn:()=>drawCorpse(c) }));
  drops.forEach(l => { if (!l.taken) items.push({ depth:l.x+l.y-1, fn:()=>drawDrop(l,t) }); });
  packs.forEach(p => {
    if (p.dead) return;
    p.wolves.forEach(w => {
      if (w.dead) return; 
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
    
    ctx.fillStyle='rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,16,6,0,0,7); ctx.fill();
    ctx.strokeStyle='#4a3a28'; ctx.lineWidth=2.2;
    ctx.beginPath();
    ctx.moveTo(c.sx-11,c.sy); ctx.lineTo(c.sx-6,c.sy-34);
    ctx.moveTo(c.sx+11,c.sy); ctx.lineTo(c.sx+6,c.sy-34);
    ctx.moveTo(c.sx-10,c.sy-8); ctx.lineTo(c.sx+10,c.sy-16); 
    ctx.moveTo(c.sx+10,c.sy-8); ctx.lineTo(c.sx-10,c.sy-16);
    ctx.stroke();
    ctx.fillStyle='#6a4a2e'; 
    ctx.fillRect(c.sx-10,c.sy-37,20,4);
    ctx.fillStyle='#5a3e26'; 
    ctx.fillRect(c.sx-10,c.sy-43,2,6); ctx.fillRect(c.sx+8,c.sy-43,2,6);
    ctx.fillStyle='#3e4a38'; 
    ctx.beginPath(); ctx.moveTo(c.sx-14,c.sy-43); ctx.lineTo(c.sx,c.sy-54); ctx.lineTo(c.sx+14,c.sy-43); ctx.closePath(); ctx.fill();
  } else if (sc.kind==='spire') {
    
    ctx.fillStyle='rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,20,7,0,0,7); ctx.fill();
    ctx.fillStyle='#6e4a34';
    ctx.beginPath();
    ctx.moveTo(c.sx-18,c.sy); ctx.lineTo(c.sx-10,c.sy-22); ctx.lineTo(c.sx-4,c.sy-40);
    ctx.lineTo(c.sx+3,c.sy-31); ctx.lineTo(c.sx+12,c.sy-18); ctx.lineTo(c.sx+18,c.sy); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#845a40'; 
    ctx.beginPath();
    ctx.moveTo(c.sx-4,c.sy-40); ctx.lineTo(c.sx+3,c.sy-31); ctx.lineTo(c.sx+12,c.sy-18); ctx.lineTo(c.sx+6,c.sy); ctx.lineTo(c.sx-1,c.sy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(40,24,16,.4)'; ctx.lineWidth=1; 
    ctx.beginPath();
    ctx.moveTo(c.sx-13,c.sy-12); ctx.lineTo(c.sx+14,c.sy-10);
    ctx.moveTo(c.sx-9,c.sy-22); ctx.lineTo(c.sx+10,c.sy-20);
    ctx.stroke();
  } else if (sc.kind==='cart') {
    
    ctx.fillStyle='rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(c.sx,c.sy+2,15,5,0,0,7); ctx.fill();
    ctx.save(); ctx.translate(c.sx,c.sy); ctx.rotate(-0.12); 
    ctx.fillStyle='#5a4430'; ctx.fillRect(-11,-13,20,9);
    ctx.fillStyle='#6e563c'; ctx.fillRect(-11,-13,20,3);
    ctx.strokeStyle='#3e2f20'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-5,-13); ctx.lineTo(-5,-4); ctx.moveTo(2,-13); ctx.lineTo(2,-4); ctx.stroke();
    ctx.fillStyle='#4e5258'; 
    ctx.beginPath(); ctx.arc(-4,-14,3,0,7); ctx.arc(1,-15,2.6,0,7); ctx.arc(5,-13.6,2.4,0,7); ctx.fill();
    ctx.restore();
    
    ctx.strokeStyle='#4a3a28'; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.ellipse(c.sx+13,c.sy-5,4.8,6,0.25,0,7); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c.sx+9.5,c.sy-8.5); ctx.lineTo(c.sx+16.5,c.sy-1.5);
    ctx.moveTo(c.sx+16,c.sy-9); ctx.lineTo(c.sx+10,c.sy-1);
    ctx.stroke();
    ctx.strokeStyle='#5a4430'; ctx.lineWidth=1.6; 
    ctx.beginPath(); ctx.moveTo(c.sx-16,c.sy+1); ctx.lineTo(c.sx-7,c.sy+4); ctx.stroke();
  } else if (sc.kind==='crevasse') {
    
    ctx.save(); ctx.translate(c.sx,c.sy); ctx.rotate(hash2(sc.x,sc.y)*Math.PI);
    ctx.scale(1,.5); 
    ctx.fillStyle='rgba(18,10,7,.75)';
    ctx.beginPath();
    ctx.moveTo(-24,0); ctx.quadraticCurveTo(-10,-5, 2,-2); ctx.quadraticCurveTo(14,1, 24,-1);
    ctx.quadraticCurveTo(12,5, -2,3); ctx.quadraticCurveTo(-14,1, -24,0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(90,54,36,.5)'; ctx.lineWidth=1.2; 
    ctx.beginPath(); ctx.moveTo(-22,-1); ctx.quadraticCurveTo(-8,-6, 4,-3); ctx.stroke();
    ctx.restore();
  } else if (sc.kind==='pebbles') {
    
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

function drawCorpse(cp) {
  const c = toScreen(cp.x,cp.y);
  ctx.save(); ctx.globalAlpha = Math.min(1,cp.life/1.2)*.8;
  ctx.fillStyle = cp.tone;
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy,15*cp.scale,6*cp.scale,.3,0,7); ctx.fill();
  ctx.restore();
}

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
  ctx.beginPath(); ctx.ellipse(0,-11,15,7.5,-.06,0,7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(9,-10,7,6.4,.2,0,7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(17,-17+trot*.2,6.4,5,.15,0,7); ctx.fill();
  ctx.beginPath(); ctx.moveTo(21,-18); ctx.lineTo(27,-15.6); ctx.lineTo(21,-14); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13,-22); ctx.lineTo(15,-27); ctx.lineTo(17.5,-21.5); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(17,-22); ctx.lineTo(19.6,-26.4); ctx.lineTo(21,-21); ctx.closePath(); ctx.fill();
  ctx.lineWidth=4;
  ctx.beginPath(); ctx.moveTo(-14,-12); ctx.quadraticCurveTo(-21,-16+trot,-24,-11+trot); ctx.stroke();
  ctx.fillStyle = w.lunge>.3 ? '#e05540' : '#e8c25a';
  ctx.beginPath(); ctx.arc(17.5,-18+trot*.2,1.2,0,7); ctx.fill();
  ctx.restore();
}

function drawProttyIso(wx,wy,w,t) {
  const c = toScreen(wx,wy);
  if (c.sx<-60||c.sx>W+60||c.sy<-60||c.sy>H+60) return;
  const facingRight = isoX(P.x-wx,P.y-wy) >= 0;
  const lungeAmt = w.lunge > 0 ? Math.sin((0.55-w.lunge)/0.55*Math.PI)*10 : 0;
  const bob = Math.sin(t*2+w.phase)*2.2; 
  ctx.fillStyle='rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(c.sx,c.sy+3,13*w.scale,5,0,0,7); ctx.fill();
  ctx.save();
  ctx.translate(c.sx+(facingRight?lungeAmt:-lungeAmt), c.sy-lungeAmt*.3+bob);
  if (!facingRight) ctx.scale(-1,1);
  ctx.scale(w.scale,w.scale);
  if (w.lunge > .3) { ctx.strokeStyle='rgba(120,210,180,.55)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-13,17,11,0,0,7); ctx.stroke(); }
  const tone = w.tone;
  
  ctx.fillStyle = tone;
  ctx.beginPath(); ctx.ellipse(0,-14,14,13,0,Math.PI,0,true); ctx.fill();
  
  ctx.fillStyle='rgba(216,205,184,.92)';
  ctx.beginPath(); ctx.ellipse(0,-6,10.5,7,0,0,Math.PI); ctx.fill();
  
  ctx.fillStyle='#c9d86a';
  [[-9,0],[-3,1],[3,1],[9,0]].forEach(([dx,ph],i) => {
    const sway = Math.sin(t*3+w.phase+ph)*1.6;
    ctx.beginPath(); ctx.moveTo(dx,-22); ctx.lineTo(dx+sway,-28-Math.abs(sway)*.3); ctx.lineTo(dx+3.2,-21.5); ctx.closePath(); ctx.fill();
  });
  
  ctx.fillStyle = tone;
  ctx.beginPath(); ctx.moveTo(-13,-13); ctx.lineTo(-21,-9+Math.sin(t*4+w.phase)*2); ctx.lineTo(-12,-6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(13,-13); ctx.lineTo(21,-9-Math.sin(t*4+w.phase)*2); ctx.lineTo(12,-6); ctx.closePath(); ctx.fill();
  
  ctx.fillStyle = w.lunge>.3 ? '#e05540' : '#2a2420';
  ctx.beginPath(); ctx.arc(4.5,-11,1.5,0,7); ctx.fill();
  ctx.restore();
}

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
  const trot = Math.sin(t*6+w.phase)*1.4; 
  if (w.lunge > .3) { ctx.strokeStyle='rgba(220,80,60,.55)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-16,14,10,0,0,7); ctx.stroke(); }
  const tone = w.tone; 
  
  ctx.strokeStyle='#3a3228'; ctx.lineWidth=3.4; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-3,-8); ctx.lineTo(-4,3+trot*.5);
  ctx.moveTo(3,-8); ctx.lineTo(4,3-trot*.5);
  ctx.stroke();
  
  ctx.fillStyle = tone;
  ctx.beginPath(); ctx.moveTo(-7,-9); ctx.lineTo(-6,-24); ctx.lineTo(6,-24); ctx.lineTo(7,-9); ctx.closePath(); ctx.fill();
  
  ctx.fillStyle='#c9a074';
  ctx.beginPath(); ctx.moveTo(-2.4,-23); ctx.lineTo(-2,-10); ctx.lineTo(2,-10); ctx.lineTo(2.4,-23); ctx.closePath(); ctx.fill();
  
  ctx.strokeStyle = tone; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(6,-22); ctx.lineTo(11+lungeAmt*.4,-14); ctx.stroke();
  ctx.strokeStyle='#c9ccd2'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(11+lungeAmt*.4,-14); ctx.lineTo(17+lungeAmt*.6,-20); ctx.stroke();
  
  ctx.fillStyle='#c9a074';
  ctx.beginPath(); ctx.arc(0,-28,4.4,0,7); ctx.fill();
  
  ctx.fillStyle='#241d16';
  ctx.beginPath(); ctx.arc(0,-25.5,3.6,0.15,Math.PI-0.15); ctx.fill();
  
  ctx.fillStyle = w.lunge>.3 ? '#c05545' : '#a03a2e';
  ctx.beginPath(); ctx.arc(0,-30,4.6,Math.PI,0); ctx.fill();
  ctx.beginPath(); ctx.moveTo(3.6,-29); ctx.lineTo(7,-27); ctx.lineTo(3.2,-26.4); ctx.closePath(); ctx.fill();
  ctx.restore();
}

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
  const trot = Math.sin(t*5.5+w.phase)*1.6; 
  if (w.lunge > .3) { ctx.strokeStyle='rgba(120,200,110,.5)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-17,15,11,0,0,7); ctx.stroke(); }
  const strap = w.tone; 
  const skin = '#7a9a52';
  
  ctx.strokeStyle='#3e3226'; ctx.lineWidth=4.4; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-4,-9); ctx.lineTo(-5,3+trot*.5);
  ctx.moveTo(4,-9); ctx.lineTo(5,3-trot*.5);
  ctx.stroke();
  
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.moveTo(-9,-9); ctx.lineTo(-8,-26); ctx.lineTo(8,-26); ctx.lineTo(9,-9); ctx.closePath(); ctx.fill();
  
  ctx.strokeStyle = strap; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-7,-24); ctx.lineTo(6,-11); ctx.stroke();
  
  ctx.strokeStyle = skin; ctx.lineWidth=4.2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(8,-23); ctx.lineTo(13+lungeAmt*.45,-13); ctx.stroke();
  ctx.strokeStyle='#8a8378'; ctx.lineWidth=2.4;
  ctx.beginPath(); ctx.moveTo(13+lungeAmt*.45,-13); ctx.lineTo(20+lungeAmt*.7,-19); ctx.stroke();
  
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(0,-30,5,0,7); ctx.fill();
  
  ctx.fillStyle='#241d16';
  ctx.beginPath(); ctx.arc(0,-27,3.4,0.1,Math.PI-0.1); ctx.fill();
  
  ctx.fillStyle='#e8e2d0';
  ctx.beginPath(); ctx.moveTo(-2.6,-26.5); ctx.lineTo(-3.2,-24); ctx.lineTo(-1.6,-25); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(2.6,-26.5); ctx.lineTo(3.2,-24); ctx.lineTo(1.6,-25); ctx.closePath(); ctx.fill();
  
  ctx.fillStyle = w.lunge>.3 ? '#c8503a' : '#a8402c';
  for (let i=-1; i<=1; i++) {
    ctx.beginPath();
    ctx.moveTo(i*2.4,-34); ctx.lineTo(i*2.4-0.9,-40-Math.abs(i)*2); ctx.lineTo(i*2.4+0.9,-34); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

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
  const trot = Math.sin(t*5+w.phase)*1.2; 
  if (w.lunge > .3) { ctx.strokeStyle='rgba(200,190,140,.5)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-17,15,11,0,0,7); ctx.stroke(); }
  const plate = w.tone; 
  
  ctx.strokeStyle='#2c2a26'; ctx.lineWidth=4.6; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-4,-9); ctx.lineTo(-5,3+trot*.4);
  ctx.moveTo(4,-9); ctx.lineTo(5,3-trot*.4);
  ctx.stroke();
  
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.moveTo(-9,-9); ctx.lineTo(-8,-25); ctx.lineTo(8,-25); ctx.lineTo(9,-9); ctx.closePath(); ctx.fill();
  
  ctx.strokeStyle='#c9a55a'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(-7,-12); ctx.lineTo(7,-12); ctx.stroke();
  
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.ellipse(-9,-23,4,3.4,0,0,7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(9,-23,4,3.4,0,0,7); ctx.fill();
  
  ctx.strokeStyle='#8a7a5a'; ctx.lineWidth=3.6; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(7,-22); ctx.lineTo(10,-30+lungeAmt*.3); ctx.stroke();
  ctx.strokeStyle='#9ba0a8'; ctx.lineWidth=2.6;
  ctx.beginPath(); ctx.moveTo(10,-30+lungeAmt*.3); ctx.lineTo(9,-41+lungeAmt*.5); ctx.stroke();
  ctx.fillStyle='#c9ccd2';
  ctx.beginPath(); ctx.moveTo(6,-40); ctx.lineTo(9,-46); ctx.lineTo(12,-40); ctx.closePath(); ctx.fill();
  
  ctx.fillStyle='#c9a074';
  ctx.beginPath(); ctx.arc(0,-29,4.6,0,7); ctx.fill();
  ctx.fillStyle='#d8d2c4';
  ctx.beginPath(); ctx.arc(0,-26,3.6,0.1,Math.PI-0.1); ctx.fill();
  
  ctx.fillStyle = plate;
  ctx.beginPath(); ctx.arc(0,-31,4.9,Math.PI,0); ctx.fill();
  ctx.fillStyle = w.lunge>.3 ? '#c8503a' : '#a8402c';
  ctx.beginPath(); ctx.moveTo(-1.4,-35); ctx.lineTo(0,-43); ctx.lineTo(1.4,-35); ctx.closePath(); ctx.fill();
  ctx.restore();
}

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
  const sway = Math.sin(t*3+w.phase)*1.1; 
  if (w.lunge > .3) { ctx.strokeStyle='rgba(210,190,140,.5)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.ellipse(0,-16,14,10,0,0,7); ctx.stroke(); }
  const cloth = w.tone; 
  
  ctx.strokeStyle='#3a352c'; ctx.lineWidth=3.4; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(-3,-8); ctx.lineTo(-4,3+trot*.5);
  ctx.moveTo(3,-8); ctx.lineTo(4,3-trot*.5);
  ctx.stroke();
  
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-7,-9); ctx.lineTo(-6,-24); ctx.lineTo(6,-24); ctx.lineTo(7,-9);
  ctx.lineTo(5+sway,-2); ctx.lineTo(-5+sway,-2); ctx.closePath(); ctx.fill();
  
  ctx.strokeStyle='rgba(230,230,240,.18)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(-5,-20); ctx.lineTo(5,-20); ctx.moveTo(-5,-15); ctx.lineTo(5,-15); ctx.moveTo(-5,-10); ctx.lineTo(5,-10); ctx.stroke();
  
  ctx.strokeStyle='#5a4632'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-6,-12); ctx.lineTo(6,-12); ctx.stroke();
  
  ctx.strokeStyle = cloth; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(6,-21); ctx.lineTo(11+lungeAmt*.4,-15); ctx.stroke();
  ctx.strokeStyle='#c9ccd2'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(11+lungeAmt*.4,-15); ctx.quadraticCurveTo(17+lungeAmt*.6,-18, 16+lungeAmt*.6,-24); ctx.stroke();
  
  ctx.fillStyle='#b8a382';
  ctx.beginPath(); ctx.arc(0,-28,4.2,0,7); ctx.fill();
  ctx.fillStyle = cloth; 
  ctx.beginPath(); ctx.arc(0,-26.5,3.9,0.1,Math.PI-0.1); ctx.fill();
  
  ctx.strokeStyle='rgba(20,16,10,.8)'; ctx.lineWidth=1.2;
  ctx.beginPath(); ctx.moveTo(-2.4,-29); ctx.lineTo(2.4,-29); ctx.stroke();
  
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-5,-28); ctx.quadraticCurveTo(-5.5,-35, 0,-37.5);
  ctx.quadraticCurveTo(5.5,-35, 5,-28);
  ctx.quadraticCurveTo(0,-31, -5,-28); ctx.closePath(); ctx.fill();
  
  ctx.beginPath(); ctx.moveTo(0,-37.5); ctx.lineTo(-1.6,-34); ctx.lineTo(1.6,-34); ctx.closePath(); ctx.fill();
  ctx.restore();
}

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
    
    ctx.strokeStyle='#2e3238'; ctx.lineWidth=5; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(-5,-8); ctx.lineTo(-6.5,3+trot*.4);
    ctx.moveTo(5,-8); ctx.lineTo(6.5,3-trot*.4);
    ctx.stroke();
    
    ctx.fillStyle = tone;
    ctx.beginPath(); ctx.ellipse(0,-17,10.5,9.5,0,0,7); ctx.fill();
    
    ctx.strokeStyle='rgba(220,228,240,.22)'; ctx.lineWidth=1.4;
    ctx.beginPath(); ctx.ellipse(0,-17,7.5,6.5,0,Math.PI*1.15,Math.PI*1.85); ctx.stroke();
    
    ctx.fillStyle='#3a3e44';
    for (const [px,py,ang] of [[-8,-23,-2.3],[-3,-26,-1.85],[3,-26,-1.3],[8,-23,-0.85]]) {
      ctx.save(); ctx.translate(px,py); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(-1.6,0); ctx.lineTo(0,-5.5); ctx.lineTo(1.6,0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    
    ctx.fillStyle='#4a5058';
    ctx.beginPath(); ctx.arc(9,-22,4.6,0,7); ctx.fill();
    ctx.fillStyle='#22262c';
    ctx.beginPath(); ctx.arc(9,-22,1.6,0,7); ctx.fill();
    
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
    
    ctx.fillStyle='#4a5058';
    ctx.beginPath(); ctx.arc(2,-27,3.6,0,7); ctx.fill();
    ctx.fillStyle='rgba(10,8,6,.85)';
    ctx.beginPath(); ctx.arc(2.8,-26.4,1.7,0,7); ctx.fill(); 
  } else {
    
    ctx.strokeStyle='#3a332a'; ctx.lineWidth=3.2; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(-3,-7); ctx.lineTo(-4,3+trot*.5);
    ctx.moveTo(3,-7); ctx.lineTo(4,3-trot*.5);
    ctx.stroke();
    
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(-6,-7); ctx.quadraticCurveTo(-8,-18, -2,-23);
    ctx.lineTo(4,-22); ctx.quadraticCurveTo(7,-14, 6,-7); ctx.closePath(); ctx.fill();
    
    ctx.strokeStyle = tone; ctx.lineWidth=2.8;
    ctx.beginPath(); ctx.moveTo(4,-19); ctx.lineTo(9+lungeAmt*.4,-13); ctx.stroke();
    ctx.strokeStyle='#5a4a38'; ctx.lineWidth=1.8; 
    ctx.beginPath(); ctx.moveTo(9+lungeAmt*.4,-13); ctx.lineTo(13+lungeAmt*.6,-24); ctx.stroke();
    ctx.strokeStyle='#8a8f96'; ctx.lineWidth=2.2; 
    ctx.beginPath(); ctx.moveTo(10+lungeAmt*.6,-26); ctx.quadraticCurveTo(13+lungeAmt*.6,-27.5, 16+lungeAmt*.6,-25); ctx.stroke();
    
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(-4,-21); ctx.quadraticCurveTo(-3,-28.5, 2,-28);
    ctx.quadraticCurveTo(6,-27, 5,-21.5); ctx.quadraticCurveTo(0,-24, -4,-21); ctx.closePath(); ctx.fill();
    
    ctx.fillStyle='rgba(12,8,6,.9)';
    ctx.beginPath(); ctx.ellipse(1.5,-22.5,2.8,2.2,-0.3,0,7); ctx.fill();
    ctx.fillStyle = w.lunge>.3 ? '#ff6a4a' : '#c8503a';
    ctx.beginPath(); ctx.arc(0.8,-22.8,0.7,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(2.8,-22.4,0.7,0,7); ctx.fill();
  }
  ctx.restore();
}

function drawZoneMobIcon() {
  const cv2 = $('zoneMobIcon'); if (!cv2) return;
  const ctx2 = cv2.getContext('2d');
  ctx2.clearRect(0,0,34,34);
  ctx2.save();
  ctx2.translate(17,19);
  if (atVelia) {
    
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
  if (zi === 1) { 
    ctx2.fillStyle='#cfc6e0';
    ctx2.beginPath(); ctx2.ellipse(0,0,8,7,0,Math.PI,0); ctx2.fill();
    ctx2.beginPath(); ctx2.ellipse(0,3,6,4,0,0,Math.PI); ctx2.fill();
    ctx2.fillStyle='#8878aa';
    ctx2.beginPath(); ctx2.arc(-2.5,-1,1.3,0,7); ctx2.fill();
    ctx2.beginPath(); ctx2.arc(2.5,-1,1.3,0,7); ctx2.fill();
  } else if (zi === 2) { 
    ctx2.fillStyle='#c9a074';
    ctx2.beginPath(); ctx2.arc(0,0,7,0,7); ctx2.fill();
    ctx2.fillStyle='#241d16';
    ctx2.beginPath(); ctx2.arc(0,4,5.5,0.15,Math.PI-0.15); ctx2.fill();
    ctx2.fillStyle='#a03a2e';
    ctx2.beginPath(); ctx2.arc(0,-3,7.4,Math.PI,0); ctx2.fill();
  } else if (zi === 3) { 
    ctx2.fillStyle='#7a9a52';
    ctx2.beginPath(); ctx2.arc(0,0,7.5,0,7); ctx2.fill();
    ctx2.fillStyle='#241d16';
    ctx2.beginPath(); ctx2.arc(0,4,5,0.1,Math.PI-0.1); ctx2.fill();
    ctx2.fillStyle='#a8402c';
    for (let i=-1;i<=1;i++) {
      ctx2.beginPath();
      ctx2.moveTo(i*3.4,-6); ctx2.lineTo(i*3.4-1.2,-13-Math.abs(i)*2); ctx2.lineTo(i*3.4+1.2,-6); ctx2.closePath(); ctx2.fill();
    }
  } else if (zi === 4) { 
    ctx2.fillStyle='#c9a074';
    ctx2.beginPath(); ctx2.arc(0,1,7,0,7); ctx2.fill();
    ctx2.fillStyle='#d8d2c4';
    ctx2.beginPath(); ctx2.arc(0,4,5,0.1,Math.PI-0.1); ctx2.fill();
    ctx2.fillStyle=tone;
    ctx2.beginPath(); ctx2.arc(0,-2,7.6,Math.PI,0); ctx2.fill();
    ctx2.fillStyle='#a8402c';
    ctx2.beginPath(); ctx2.moveTo(-1.6,-8); ctx2.lineTo(0,-14); ctx2.lineTo(1.6,-8); ctx2.closePath(); ctx2.fill();
  } else if (zi === 5) { 
    ctx2.fillStyle='#b8a382';
    ctx2.beginPath(); ctx2.arc(0,1,6.4,0,7); ctx2.fill();
    ctx2.fillStyle=tone; 
    ctx2.beginPath(); ctx2.arc(0,4,5,0.1,Math.PI-0.1); ctx2.fill();
    ctx2.strokeStyle='rgba(20,16,10,.8)'; ctx2.lineWidth=1.4; 
    ctx2.beginPath(); ctx2.moveTo(-3,-1); ctx2.lineTo(3,-1); ctx2.stroke();
    ctx2.fillStyle=tone; 
    ctx2.beginPath();
    ctx2.moveTo(-7,-1); ctx2.quadraticCurveTo(-8,-11, 0,-15);
    ctx2.quadraticCurveTo(8,-11, 7,-1);
    ctx2.quadraticCurveTo(0,-5, -7,-1); ctx2.closePath(); ctx2.fill();
    ctx2.beginPath(); ctx2.moveTo(0,-15); ctx2.lineTo(-2.4,-10); ctx2.lineTo(2.4,-10); ctx2.closePath(); ctx2.fill();
  } else if (zi === 6) { 
    ctx2.fillStyle=tone;
    ctx2.beginPath();
    ctx2.moveTo(-7,3); ctx2.quadraticCurveTo(-7.5,-9, 0,-11);
    ctx2.quadraticCurveTo(7.5,-9, 7,3); ctx2.closePath(); ctx2.fill();
    ctx2.fillStyle='rgba(12,8,6,.92)';
    ctx2.beginPath(); ctx2.ellipse(0,-2,4.4,3.6,0,0,7); ctx2.fill();
    ctx2.fillStyle='#c8503a';
    ctx2.beginPath(); ctx2.arc(-1.8,-2.4,1,0,7); ctx2.fill();
    ctx2.beginPath(); ctx2.arc(1.8,-2.4,1,0,7); ctx2.fill();
  } else { 
    ctx2.fillStyle='#8a8f96';
    ctx2.beginPath(); ctx2.moveTo(-6,4); ctx2.lineTo(-8,-6); ctx2.lineTo(-3,-2); ctx2.lineTo(0,-8); ctx2.lineTo(3,-2); ctx2.lineTo(8,-6); ctx2.lineTo(6,4); ctx2.closePath(); ctx2.fill();
    ctx2.fillStyle='#c9ccd2';
    ctx2.beginPath(); ctx2.moveTo(-2,4); ctx2.lineTo(0,7); ctx2.lineTo(2,4); ctx2.closePath(); ctx2.fill();
  }
  ctx2.restore();
}

function drawMonsterIso(wx,wy,w,t) {
  if (zoneIdx === 1) return drawProttyIso(wx,wy,w,t);
  if (zoneIdx === 2) return drawPirateIso(wx,wy,w,t);
  if (zoneIdx === 3) return drawRhutumIso(wx,wy,w,t);
  if (zoneIdx === 4) return drawShultzIso(wx,wy,w,t);
  if (zoneIdx === 5) return drawSausanIso(wx,wy,w,t);
  if (zoneIdx === 6) return drawMineurIso(wx,wy,w,t);
  return drawWolfIso(wx,wy,w,t);
}

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
      
      const c = toScreen(q.x,q.y,q.z||0);
      switch (q.style) {
        case 'ember':
          ctx.fillStyle=`rgba(232,147,90,${a})`;
          ctx.beginPath(); ctx.arc(c.sx,c.sy,4+3*(1-a),0,7); ctx.fill();
          break;
        case 'frost': {
          const shrink = 1-a; 
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
          const grow = 1-a; 
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

renderInvCatTabs();
hud();
setInterval(hud, 1000);
setInterval(() => { if (!document.hidden) S.playtimeSec++; }, 1000); 
setTimeout(()=>{ addSilver(80, 'welcome'); hud(); }, 1200);

setInterval(() => { try { localStorage.setItem('velia-idle-save', JSON.stringify(getSaveState())); } catch(e) {} }, 15000);
requestAnimationFrame(loop);

// ==== src/backend/game-supabase.js ====
const SUPABASE_URL = 'https://mkwwvzbjtyawpcyrnybk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_c7HLxbeBLe01rirZVg-XPA_TClYulIJ';

let sb = null, currentUser = null;
try {
  if (window.supabase && SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('TON-PROJET')) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) { console.warn('Supabase non initialisé :', e); }

const BOT_API_URL = 'https://black-desert-idle-discord-bot.onrender.com';
const BOT_API_SECRET = 'TON-SECRET-PARTAGE';
let myPseudo = null; 
let myIsMod = false; 
let myIsTester = false; 
async function refreshMyTesterStatus() {
  myIsTester = false;
  if (sb && currentUser && !isGuest()) {
    try { const { data } = await sb.from('testers').select('user_id').eq('user_id', currentUser.id).maybeSingle(); myIsTester = !!data; } catch (e) {}
  }
  const b = $a('btnTester'); if (b) b.style.display = myIsTester ? '' : 'none';
}
async function refreshMyModStatus() {
  myIsMod = false;
  if (!sb || !currentUser || isGuest()) { if (typeof renderChatTabs==='function') renderChatTabs(); return; }
  try {
    const { data } = await sb.from('chat_mods').select('user_id').eq('user_id', currentUser.id).maybeSingle();
    myIsMod = !!data;
  } catch (e) {}
  
  if (typeof renderChatTabs === 'function') renderChatTabs();
}

const ADMIN_EMAIL = 'maxime.lacoste@icloud.com';
function isAdmin() { return !!(currentUser && currentUser.email === ADMIN_EMAIL); }

function isGuest() { return !!(currentUser && currentUser.is_anonymous); }

let farmEventQueue = new Map();
function queueFarmEvent(kind, name, qty, silverVal) {
  if (!sb || !currentUser || isGuest()) return; 
  const zone = Z().name;
  const key = kind + '|' + name + '|' + zone;
  const cur = farmEventQueue.get(key);
  if (cur) { cur.qty += qty; cur.silver_value += silverVal; }
  else farmEventQueue.set(key, { user_id: currentUser.id, item_name: name, item_kind: kind, qty, silver_value: silverVal, zone_name: zone });
}
async function flushFarmEvents() {
  if (!sb || !currentUser || isGuest() || farmEventQueue.size === 0) return;
  const batch = Array.from(farmEventQueue.values());
  farmEventQueue.clear();
  try { await sb.from('farm_events').insert(batch); } catch(e) {  }
}
setInterval(flushFarmEvents, 25000);
window.addEventListener('beforeunload', flushFarmEvents);

let silverLedgerQueue = new Map();
function queueSilverLedger(delta, category, note) {
  if (!sb || !currentUser || isGuest() || !delta) return; 
  const key = category + '|' + (note || '');
  const cur = silverLedgerQueue.get(key);
  if (cur) cur.delta += Math.round(delta);
  else silverLedgerQueue.set(key, { user_id: currentUser.id, delta: Math.round(delta), category, note: note || null });
}
async function flushSilverLedger() {
  if (!sb || !currentUser || isGuest() || silverLedgerQueue.size === 0) return;
  const batch = Array.from(silverLedgerQueue.values()).filter(r => r.delta !== 0);
  silverLedgerQueue.clear();
  if (batch.length === 0) return;
  try { await sb.from('silver_ledger').insert(batch); } catch(e) {  }
}
setInterval(flushSilverLedger, 25000);
window.addEventListener('beforeunload', flushSilverLedger);

function authShow(msg, isError) {
  $a('authError').textContent = isError ? msg : '';
  $a('authStatus').textContent = isError ? '' : (msg || '');
}
function showAuthOverlay(show) { $a('authOverlay').classList.toggle('hidden', !show); }
function updateUserBar() {
  $a('userBar').classList.toggle('show', !!currentUser);
  $a('userEmail').textContent = ''; 
  $a('btnLinkAccount').style.display = isGuest() ? '' : 'none';
  $a('btnLogout').style.display = isGuest() ? 'none' : '';
  $a('adminBox').style.display = isAdmin() ? '' : 'none';
  const adminMaxEnhBtn = $a('btnAdminMaxEnh'); if (adminMaxEnhBtn) adminMaxEnhBtn.style.display = isAdmin() ? '' : 'none';
  const adminResetEnhBtn = $a('btnAdminResetEnh'); if (adminResetEnhBtn) adminResetEnhBtn.style.display = isAdmin() ? '' : 'none';
  const adminEnhStepRow = $a('adminEnhStepRow'); if (adminEnhStepRow) adminEnhStepRow.style.display = isAdmin() ? '' : 'none';
  const adminTierRow = $a('adminTierRow'); if (adminTierRow) adminTierRow.style.display = isAdmin() ? '' : 'none';
  
  const uuidRow = $a('uuidRow');
  if (uuidRow) uuidRow.style.display = currentUser ? 'flex' : 'none';
  updatePseudoDisplay();
  if (typeof updateChatInputVisibility === 'function') { updateChatInputVisibility(); fetchChatMessages(); }
}

function updatePseudoDisplay() {
  const el = $a('userPseudo');
  if (!el) return;
  if (isGuest()) el.textContent = LANG==='fr'?'🎭 Invité':'🎭 Guest';
  else el.textContent = (currentUser && myPseudo) ? myPseudo : '';
}

const PENDING_PSEUDO_KEY = 'velia-idle-pending-pseudo';
async function doSignUp() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  const email = $a('authEmail').value.trim(), pass = $a('authPass').value;
  const pseudo = $a('authPseudo').value.trim();
  if (!email || pass.length < 6) { authShow('Email requis + mot de passe 6 caractères min.', true); return; }
  authShow('Création du compte...');
  if (pseudo) { try { localStorage.setItem(PENDING_PSEUDO_KEY, pseudo); } catch(e) {} }
  if (isGuest()) {
    
    const { data, error } = await sb.auth.updateUser({ email, password: pass }, { emailRedirectTo: location.href });
    if (error) { authShow(error.message, true); return; }
    onAuthed(data.user);
    authShow('Compte lié ! Ta progression est conservée.');
    return;
  }
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { emailRedirectTo: location.href } });
  if (error) { authShow(error.message, true); return; }
  if (data.session) { onAuthed(data.session.user); }
  else authShow('Compte créé ! Vérifie ta boîte mail pour confirmer, puis connecte-toi.');
}
async function doSignIn() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  const email = $a('authEmail').value.trim(), pass = $a('authPass').value;
  if (!email || !pass) { authShow('Email et mot de passe requis.', true); return; }
  authShow('Connexion...');
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) { authShow(error.message, true); return; }
  onAuthed(data.user);
}

async function doForgotPassword() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  const email = $a('authEmail').value.trim();
  if (!email) { authShow(LANG==='fr' ? 'Entre ton email d\'abord, puis clique à nouveau.' : 'Enter your email first, then click again.', true); return; }
  authShow(LANG==='fr' ? 'Envoi en cours…' : 'Sending…');
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href });
  if (error) { authShow(error.message, true); return; }
  authShow(LANG==='fr' ? 'Email envoyé — vérifie ta boîte mail pour réinitialiser ton mot de passe.' : 'Email sent — check your inbox to reset your password.');
}
async function doLogout() {
  if (sb) await sb.auth.signOut();
  currentUser = null;
  await startGuestOrShowAuth(); 
}

async function doSignInDiscord() {
  if (!sb) { authShow('Supabase non configuré — voir SUPABASE_URL en haut du script.', true); return; }
  await sb.auth.signInWithOAuth({
    provider: 'discord',
    options: { scopes: 'identify guilds.join', redirectTo: location.href },
  });
}

async function linkDiscordAccount() {
  if (!sb || !currentUser) return;
  const { error } = await sb.auth.linkIdentity({
    provider: 'discord',
    options: { scopes: 'identify guilds.join', redirectTo: location.href },
  });
  if (error) alert('Erreur : ' + error.message);
}

function discordIdentity(user) {
  return user?.identities?.find(i => i.provider === 'discord') || null;
}
function discordUsername(user) {
  const id = discordIdentity(user);
  const d = id?.identity_data || {};
  return d.custom_claims?.global_name || d.full_name || d.name || d.user_name || null;
}

async function joinDiscordGuild(providerToken, user) {
  const id = discordIdentity(user);
  if (!providerToken || !id || !BOT_API_URL || BOT_API_URL.includes('TON-')) return;
  try {
    await fetch(BOT_API_URL + '/join-guild', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': BOT_API_SECRET },
      body: JSON.stringify({ discordUserId: id.id, accessToken: providerToken }),
    });
  } catch (e) {  }
}
if (sb) {
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.provider_token) {
      joinDiscordGuild(session.provider_token, session.user);
    }
    
    if (event === 'SIGNED_IN' && session?.user && !session.user.is_anonymous
        && (!currentUser || currentUser.id !== session.user.id)) {
      onAuthed(session.user);
    }
  });
}

let onAuthedRunning = false;
async function onAuthed(user) {
  if (onAuthedRunning) return; 
  onAuthedRunning = true;
  try {
    await onAuthedInner(user);
  } finally {
    onAuthedRunning = false;
  }
}
async function onAuthedInner(user) {
  currentUser = user;
  showAuthOverlay(false);
  updateUserBar();
  await refreshMyPseudo();
  refreshMyModStatus();
  refreshMyTesterStatus();
  await loadCloudSave();
  startAutoCloudSave();
  heartbeatPresence();
  refreshOnlineCounter();
  refreshLiveBoss(); 
  
  if (isGuest()) {
    setTimeout(() => {
      pushNotif('🎭', LANG==='fr'?'Tu joues en mode invité':'You\'re playing as a guest',
        LANG==='fr'
          ? 'Ta progression n\'est sauvegardée que sur cet appareil/navigateur — elle serait perdue en cas de changement ou de nettoyage du cache. Clique sur "🔗 Lier un compte" pour créer un compte (ta progression actuelle sera conservée) ou te reconnecter à un compte existant.'
          : 'Your progress is only saved on this device/browser — it would be lost if you switch or clear your cache. Click "🔗 Link account" to create an account (your current progress is kept) or sign back into an existing one.',
        'info');
    }, 3000);
  }
}

async function refreshMyPseudo() {
  myPseudo = null;
  if (!sb || !currentUser || isGuest()) return;
  try {
    const { data } = await sb.from('profiles').select('pseudo').eq('user_id', currentUser.id).maybeSingle();
    myPseudo = data?.pseudo || discordUsername(currentUser) || (currentUser.email || '?').split('@')[0];
  } catch (e) { myPseudo = discordUsername(currentUser) || (currentUser.email || '?').split('@')[0]; }
  
  let pending = null;
  try { pending = localStorage.getItem(PENDING_PSEUDO_KEY); } catch(e) {}
  if (pending) {
    try { localStorage.removeItem(PENDING_PSEUDO_KEY); } catch(e) {}
    try {
      const { error } = await sb.rpc('set_pseudo', { p_pseudo: pending });
      if (!error) myPseudo = pending;
    } catch (e) {}
  }
  updatePseudoDisplay();
}

async function startGuestOrShowAuth() {
  if (!sb) { showAuthOverlay(false); updateUserBar(); return; }
  try {
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    onAuthed(data.user);
  } catch (e) {
    showAuthOverlay(true);
    authShow('');
  }
}

let tutorialAutoShown = false; 
async function loadCloudSave() {
  if (!sb || !currentUser) return;
  $a('saveStatus').textContent = 'Chargement...';
  const { data, error } = await sb.from('game_saves').select('save_data').eq('user_id', currentUser.id).single();
  if (data && data.save_data && Object.keys(data.save_data).length) {
    applySaveState(data.save_data);
    $a('saveStatus').textContent = 'Sauvegarde chargée ✓';
  } else {
    $a('saveStatus').textContent = 'Nouveau personnage';
    
    if (!tutorialAutoShown) { tutorialAutoShown = true; setTimeout(startTutorial, 500); }
    
    if (typeof PATCH_NOTES !== 'undefined' && PATCH_NOTES.length) {
      PATCH_NOTES.slice(1).forEach(p => readPatches.add(p.v));
      try { localStorage.setItem('velia-patch-read', JSON.stringify([...readPatches])); } catch(e) {}
      if (typeof updatePatchBadge === 'function') updatePatchBadge();
    }
  }
  setTimeout(() => { if ($a('saveStatus')) $a('saveStatus').textContent = ''; }, 3000);
  checkPendingNotice(); 
  saveReady = true; 
}

async function saveToCloud() {
  if (!sb || !currentUser) return;
  const { error } = await sb.from('game_saves').upsert({ user_id: currentUser.id, save_data: getSaveState() });
  $a('saveStatus').textContent = error ? '✗ échec sauvegarde' : '✓ sauvegardé';
  setTimeout(() => { if ($a('saveStatus')) $a('saveStatus').textContent = ''; }, 2000);
  syncPlayerStats();
}

async function syncPlayerStats() {
  if (!sb || !currentUser || isGuest()) return; 
  
  const best = bestFarmedItem();
  
  const treasureCount = treasureTotal(S);
  
  try {
    await sb.from('player_stats').upsert({
      user_id: currentUser.id,
      display_name: myPseudo || (currentUser.email||'?').split('@')[0],
      silver: Math.round(S.silverEarned||0),
      gearscore: Math.round(S.bestGearscore||0),
      ap: Math.round((S.bestAp||0)*10)/10,
      dp: Math.round((S.bestDp||0)*10)/10,
      lvl: S.lvl,
      best_zone_index: S.maxZoneIdx,
      best_zone_name: ZONES[S.maxZoneIdx] ? ZONES[S.maxZoneIdx].name : '',
      silver_per_hour: Math.round(S.bestSilverPerHour||0),
      playtime_sec: Math.round(S.playtimeSec),
      best_item_name: best ? best.name : '',
      best_item_count: best ? best.count : 0,
      treasure_count: treasureCount,
      loyalty: Math.round(S.loyalty||0),
      best_kpm: Math.round((S.bestKpm||0)*10)/10,
      updated_at: new Date().toISOString(),
    });
  } catch(e) {  }
}

function rankRows(rows, valueFn, fmtFn) {
  const sorted = [...rows].sort((a,b) => valueFn(b) - valueFn(a)).slice(0,20);
  return sorted.map((r,i) => `
    <tr class="${r.user_id===currentUser?.id ? 'isYou' : ''}">
      <td>#${i+1}</td><td><span class="plNameLink" data-uid="${r.user_id}" data-name="${escapeHtml(r.display_name||'?')}">${escapeHtml(r.display_name||'?')}</span></td><td>${fmtFn(r)}</td>
    </tr>`).join('') || `<tr><td colspan="3" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;
}

function wirePlayerNameLinks() {
  $a('infoBody').querySelectorAll('.plNameLink').forEach(el => {
    el.onclick = e => { e.stopPropagation(); showPlayerGear(el.dataset.uid, el.dataset.name); };
  });
}
function readonlyPdSlotsHtml(equip, ids) {
  return ids.map(id => {
    const e = equip ? equip[id] : null;
    return `<div class="pdSlot ${e?'filled':'empty'}" title="${escapeHtml(SLOT_LABEL[id]||'')}${e ? ' — '+escapeHtml(e.name||'')+pdStatSuffix(e) : ' ('+(LANG==='fr'?'vide':'empty')+')'}">${pdSlotInnerHtmlFor(id, e)}</div>`;
  }).join('');
}

function readonlyGearListHtml(equip) {
  const allSlots = [...PD_BOTTOM, ...PD_LEFT, ...PD_RIGHT];
  const rows = allSlots.map(id => {
    const e = equip ? equip[id] : null;
    if (!e) return '';
    return `<tr><td>${escapeHtml(SLOT_LABEL[id]||id)}</td><td>${escapeHtml(e.name||'?')}</td><td>${pdStatSuffix(e).replace(/^ \(|\)$/g,'') || '—'}</td></tr>`;
  }).filter(Boolean).join('');
  if (!rows) return `<div class="admEmpty">${LANG==='fr'?'Aucun équipement':'No gear equipped'}</div>`;
  return `<table class="admTable"><thead><tr><th>${LANG==='fr'?'Emplacement':'Slot'}</th><th>${LANG==='fr'?'Objet':'Item'}</th><th>PA/PD/PV</th></tr></thead><tbody>${rows}</tbody></table>`;
}
async function showPlayerGear(userId, displayName) {
  if (!sb) return;
  openInfo((LANG==='fr'?'⚔️ Stuff de ':'⚔️ Gear of ')+displayName,
    `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`);
  const { data, error } = await sb.rpc('get_player_gear', { p_user_id: userId });
  if (error) { $a('infoBody').innerHTML = `<div class="admEmpty">${escapeHtml(error.message)}</div>`; return; }
  
  const copyBtn = isAdmin() ? `<button id="btnCopyGearUuid" style="margin-bottom:8px">📋 ${LANG==='fr'?'Copier UUID':'Copy UUID'}</button>` : '';
  $a('infoBody').innerHTML = copyBtn +
    `<div id="pdWeapons">${readonlyPdSlotsHtml(data, PD_BOTTOM)}</div>` +
    `<div id="paperdoll"><div class="pdCol">${readonlyPdSlotsHtml(data, PD_LEFT)}</div>` +
    `<div class="pdCenter"></div><div class="pdCol">${readonlyPdSlotsHtml(data, PD_RIGHT)}</div></div>` +
    readonlyGearListHtml(data);
  if (isAdmin()) {
    $a('btnCopyGearUuid').onclick = async () => {
      try { await navigator.clipboard.writeText(userId); } catch(e) {}
      floatTxt(P.x, P.y, 100, LANG==='fr'?'UUID copié ✓':'UUID copied ✓', { gold:true });
    };
  }
}

async function showPlayerInventoryWindow(userId, displayName) {
  if (!isAdmin() || !sb) return;
  const win = window.open('', '_blank', 'width=620,height=760');
  if (!win) { floatTxt(P.x, P.y, 100, LANG==='fr'?'Popup bloquée par le navigateur':'Popup blocked by browser', { hurt:true }); return; }
  const safeName = escapeHtml(displayName || '?');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>🎒 ${safeName}</title><style>
    body{background:#141319;color:#e8e3d8;font-family:Georgia,serif;padding:14px;margin:0;}
    h2{font-size:15px;margin:0 0 10px;}
    h3{font-size:12px;margin:14px 0 6px;color:#c9a55a;font-weight:normal;letter-spacing:.5px;}
    .admSummary{font-size:11px;color:#a89f8c;margin-bottom:10px;}
    .admEmpty{color:#a89f8c;font-size:12px;font-style:italic;text-align:center;padding:10px 0;}
    .admInvGrid{display:grid;grid-template-columns:repeat(8,1fr);gap:3px;}
    .cell{aspect-ratio:1;background:#1c1a22;border:1px solid #2c2a33;position:relative;font-size:14px;
      display:flex;align-items:center;justify-content:center;border-radius:3px;}
    .cell.catHidden{display:none;}
    .qty{position:absolute;bottom:1px;right:2px;font-size:8.5px;color:#cfc8ba;}
    .paperdollBox{display:flex;justify-content:center;gap:22px;margin-bottom:8px;}
    .pdCol{display:flex;flex-direction:column;gap:5px;}
    #pdRight{flex-direction:column;flex-wrap:wrap;max-height:153px;gap:5px;}
    .pdSlot{width:42px;height:42px;border:1px solid #3a3742;background:rgba(20,19,26,.9);
      display:flex;align-items:center;justify-content:center;font-size:18px;position:relative;border-radius:3px;}
    .pdSlot.filled{border-color:#c9a55a88;background:#231f16;}
    .pdSlot.empty{opacity:.42;filter:grayscale(1);}
    .gicon{width:1.5em;height:1.5em;vertical-align:middle;flex-shrink:0;}
    #pdWeapons{display:flex;justify-content:center;gap:6px;padding:6px 0 10px;border-bottom:1px solid #2c2a33;margin-bottom:8px;}
    #pdWeapons .pdSlot{width:46px;height:46px;}
    .admTable{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:4px;}
    .admTable th{text-align:left;color:#a89f8c;font-weight:normal;font-size:9.5px;padding:2px 6px;}
    .admTable td{padding:4px 6px;border-bottom:1px solid #201f26;color:#e8e3d8;}
    .catTabs{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 8px;}
    .catTab{width:auto;margin:0;padding:5px 9px;font-size:10.5px;background:transparent;color:#e8e3d8;
      border:1px solid #3a3742;border-radius:3px;cursor:pointer;font-family:inherit;}
    .catTab.active{border-color:#c9a55a;color:#c9a55a;}
    .catTab.locked{opacity:.45;cursor:not-allowed;}
    button{font-family:inherit;}
  </style></head><body><h2>🎒 ${safeName}</h2><div id="body"><div class="admEmpty">Chargement…</div></div></body></html>`);
  win.document.close();
  
  const checkClosed = setInterval(() => {
    if (win.closed) { clearInterval(checkClosed); openAdminPanel(); }
  }, 400);
  const [{ data: gear, error: gearErr }, { data: inv0, error: invErr }] = await Promise.all([
    sb.rpc('get_player_gear', { p_user_id: userId }),
    sb.rpc('admin_get_player_inventory', { p_user_id: userId }),
  ]);
  if (win.closed) return;
  const bodyEl = win.document.getElementById('body');
  if (gearErr || invErr) { bodyEl.innerHTML = `<div class="admEmpty">${escapeHtml((gearErr||invErr).message)}</div>`; return; }
  const inv = Array.isArray(inv0) ? inv0 : [];
  const used = inv.filter(Boolean).length;
  function cellHtml(s, visible) {
    if (!s) return `<div class="cell"></div>`;
    const apDp = (s.kind === 'gear' || s.kind === 'jackpot') ? effectiveApDp(s) : null;
    const bits = [tr(s.name)];
    if (s.qty > 1) bits.push('×'+s.qty);
    if (apDp && apDp.ap) bits.push('+'+apDp.ap+' PA');
    if (apDp && apDp.dp) bits.push('+'+apDp.dp+' PD');
    if (apDp && apDp.hp) bits.push('+'+apDp.hp+' PV');
    if (apDp && apDp.dodge) bits.push('+'+apDp.dodge+'% Esq.');
    if (s.enhLv) bits.push(ENH_NAMES[s.enhLv]);
    return `<div class="cell${visible?'':' catHidden'}" title="${escapeHtml(bits.join(' · '))}">` +
      `<span style="color:${s.color}">${s.icon}</span>` +
      `${s.qty > 1 ? `<span class="qty">${fmt(s.qty)}</span>` : ''}</div>`;
  }
  let invCat = 'normal';
  function renderInvPane() {
    const cat = INV_CATEGORIES.find(c => c.id === invCat) || INV_CATEGORIES[0];
    const gridEl = win.document.getElementById('admGrid');
    if (!gridEl) return;
    gridEl.innerHTML = inv.map(s => cellHtml(s, !s || cat.kinds.includes(s.kind))).join('');
  }
  const tabsHtml = INV_CATEGORIES.map(c => `<button class="catTab${c.id===invCat?' active':''}${c.locked?' locked':''}"` +
    `${c.locked?' disabled title="'+(LANG==='fr'?'Bientôt disponible':'Coming soon')+'"':''} data-cat="${c.id}">${c.locked?'🔒 ':''}${c.icon} ${c.label[LANG]}</button>`).join('');
  bodyEl.innerHTML =
    `<h3>${LANG==='fr'?'Équipement':'Gear'}</h3>` +
    `<div id="pdWeapons">${readonlyPdSlotsHtml(gear, PD_BOTTOM)}</div>` +
    `<div class="paperdollBox"><div class="pdCol">${readonlyPdSlotsHtml(gear, PD_LEFT)}</div>` +
    `<div class="pdCol" id="pdRight">${readonlyPdSlotsHtml(gear, PD_RIGHT)}</div></div>` +
    readonlyGearListHtml(gear) +
    `<h3>${LANG==='fr'?'Sac':'Bag'}</h3>` +
    `<div class="admSummary">${used} / ${inv.length || INV_SIZE} ${LANG==='fr'?'cases utilisées':'slots used'}</div>` +
    `<div class="catTabs">${tabsHtml}</div>` +
    `<div class="admInvGrid" id="admGrid"></div>`;
  win.document.querySelectorAll('.catTab:not(.locked)').forEach(btn => {
    btn.onclick = () => {
      invCat = btn.dataset.cat;
      win.document.querySelectorAll('.catTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderInvPane();
    };
  });
  renderInvPane();
}

function wireCatTabs() {
  $a('infoBody').querySelectorAll('.catTab').forEach(btn => {
    btn.onclick = () => {
      $a('infoBody').querySelectorAll('.catTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $a('infoBody').querySelectorAll('.catPane').forEach(p => p.style.display = p.dataset.cat === btn.dataset.cat ? '' : 'none');
    };
  });
}

async function openLeaderboard() {
  if (!marketRequireAuth()) return;
  const { data, error } = await sb.from('player_stats').select('*').limit(500);
  const rows = data || [];

  const cats = [
    { id:'silver', icon:'💰', label:{fr:'Silver',en:'Silver'}, col:{fr:'Silver (total à vie)',en:'Silver (lifetime total)'},
      rows: rankRows(rows, r => Number(r.silver||0), r => fmt(r.silver||0)) },
    { id:'gs', icon:'⚔️', label:{fr:'Gearscore',en:'Gearscore'}, col:{fr:'Record GS (PA/PD)',en:'Record GS (AP/DP)'},
      rows: rankRows(rows, r => Number(r.gearscore||0), r => `${Math.round(r.gearscore||0)} (${(r.ap||0).toFixed(1)}/${(r.dp||0).toFixed(1)})`) },
    { id:'zone', icon:'🗺️', label:{fr:'Meilleure zone',en:'Best zone'}, col:{fr:'Zone',en:'Zone'},
      rows: rankRows(rows, r => Number(r.best_zone_index||0), r => tr(r.best_zone_name||'—')) },
    { id:'sh', icon:'⏱️', label:{fr:'Silver/heure',en:'Silver/hour'}, col:{fr:'Taux (zone)',en:'Rate (zone)'},
      rows: rankRows(rows, r => Number(r.silver_per_hour||0), r => `${fmt(r.silver_per_hour||0)}/h · ${tr(r.best_zone_name||'—')}`) },
    { id:'kpm', icon:'🏹', label:{fr:'Record kills/min',en:'Kills/min record'}, col:{fr:'Kills/min',en:'Kills/min'},
      rows: rankRows(rows, r => Number(r.best_kpm||0), r => `${(r.best_kpm||0).toFixed(1)}/min · ${tr(r.best_zone_name||'—')}`) },
    { id:'item', icon:'🎯', label:{fr:'Meilleur objet',en:'Best item'}, col:{fr:'Objet (qté)',en:'Item (qty)'},
      rows: rankRows(rows.filter(r => r.best_item_name), r => Number(r.best_item_count||0), r => `${tr(r.best_item_name)} (${fmt(r.best_item_count||0)})`) },
    { id:'treasure', icon:'🗺️', label:{fr:'Trésors',en:'Treasures'}, col:{fr:'Morceaux',en:'Pieces'},
      rows: rankRows(rows, r => Number(r.treasure_count||0), r => fmt(r.treasure_count||0)) },
  ];
  const tabsHtml = cats.map((c,i) => `<button class="catTab${i===0?' active':''}" data-cat="${c.id}">${c.icon} ${c.label[LANG]}</button>`).join('');
  const panesHtml = cats.map((c,i) => `
    <div class="catPane" data-cat="${c.id}"${i===0?'':' style="display:none"'}>
      <table class="admTable"><thead><tr><th>#</th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>${c.col[LANG]}</th></tr></thead><tbody>${c.rows}</tbody></table>
    </div>`).join('');
  const html = `<div class="catTabs">${tabsHtml}</div>${panesHtml}` +
    `<div class="admSummary">${LANG==='fr'?'Classement des records personnels À VIE — jamais un instantané, ces valeurs ne redescendent jamais.':'Lifetime personal record leaderboard — never a live snapshot, these values never go down.'}</div>`;
  openInfo(LANG==='fr' ? '🏆 Classement' : '🏆 Leaderboard', html);
  wireCatTabs();
  wirePlayerNameLinks();
}
$a('btnLeaderboard').onclick = openLeaderboard;
$a('btnNotifCenter').onclick = openNotifCenter;
updateNotifBadge();
$a('btnAchievements').onclick = openAchievements;
$a('btnCompendium').onclick = openCompendium;
$a('ztCompendium').onclick = openCompendium;
$a('btnDailyQuests').onclick = openDailyQuests;
$a('btnMailbox').onclick = openMailbox;

document.querySelectorAll('.invModeTab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.invModeTab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.mode;
    $a('invModeInvPane').style.display = mode === 'inv' ? '' : 'none';
    $a('invModeCraftPane').style.display = mode === 'craft' ? '' : 'none';
    $a('invModeCompendiumPane').style.display = mode === 'compendium' ? '' : 'none';
    if (mode === 'craft') renderTreasureCraftPanel();
    else if (mode === 'compendium') renderCompendiumPane();
  };
});
renderActivityTabs();

$a('bossLeaveBtn').onclick = () => { if (bossState.active) endBossFight(false); else openBossLobby(); };
$a('potSlot').onclick = togglePotSelect;

$a('skillBarToggle').onclick = () => {
  $a('skillBar').classList.toggle('expanded');
  $a('skillBarToggle').classList.toggle('expanded');
};
$a('farmModeSlider').querySelectorAll('.farmModeSeg').forEach(seg => {
  seg.onclick = () => setFarmMode(seg.dataset.mode);
});
renderFarmModeBtn();

$a('aiModeSlider').querySelectorAll('.aiModeSeg').forEach(seg => {
  seg.onclick = () => setAiCombatMode(seg.dataset.mode);
});
renderAiModeBtn();

$a('equipModeSlider').querySelectorAll('.equipModeSeg').forEach(seg => {
  seg.onclick = () => setEquipMode(seg.dataset.mode);
});
renderEquipModeBtn();

cv.addEventListener('click', e => {
  const rect = cv.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (W / rect.width);
  const sy = (e.clientY - rect.top) * (H / rect.height);
  const candidates = drops.filter(l => !l.taken).map(l => {
    const s = toScreen(l.x, l.y);
    return { l, d: Math.hypot(sx - s.sx, sy - s.sy) };
  }).sort((a, b) => a.d - b.d);
  if (candidates.length && candidates[0].d < 34) {
    P.manualTarget = { x: candidates[0].l.x, y: candidates[0].l.y };
  }
});
$a('bossLobbyClose').onclick = () => showActivityPage('zone');
window.addEventListener('resize', () => { if (bossState.active) resizeBossCanvas(); });
updateNextBossMini();
setInterval(updateNextBossMini, 1000);

async function heartbeatPresence() {
  if (!sb || !currentUser) return;
  try { await sb.rpc('heartbeat_presence', { p_is_guest: isGuest(), p_zone_idx: atVelia ? -1 : zoneIdx }); } catch(e) {}
}

async function refreshVeliaPlayers() {
  if (!sb || !atVelia) return;
  try {
    const { data, error } = await sb.rpc('get_velia_players', { p_window_seconds: 90 });
    if (error || !data) return;
    veliaPlayers = data;
    if (typeof updateVeliaPlayersTicker === 'function') updateVeliaPlayersTicker();
  } catch(e) {}
}

async function refreshZonePlayerCounts() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_zone_player_counts', { p_window_seconds: 90 });
    if (error || !data) return;
    zonePlayerCounts = {};
    data.forEach(r => { zonePlayerCounts[r.zone_idx] = r.cnt; });
    if (typeof updateZonePlayerCountBadges === 'function') updateZonePlayerCountBadges();
  } catch(e) {}
}

async function refreshAdminZone() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_admin_zone', { p_window_seconds: 90 });
    if (error) return;
    const next = (data === null || data === undefined) ? null : Number(data);
    if (next !== adminZoneIdx) {
      adminZoneIdx = next;
      if (typeof buildZoneList === 'function') buildZoneList();
    }
  } catch(e) {}
}
async function refreshOnlineCounter() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_online_counts', { p_window_seconds: 90 });
    if (error || !data || !data[0]) return;
    const { total, guests } = data[0];
    $a('onlineTotal').textContent = total;
    $a('onlineGuests').textContent = guests > 0 ? ` (${guests} ${LANG==='fr'?'invités':'guests'})` : '';
  } catch(e) {}
}

async function refreshRegisteredCounter() {
  if (!sb) return;
  try {
    const { data, error } = await sb.rpc('get_registered_count');
    if (error || data == null) return;
    $a('registeredTotal').textContent = data;
  } catch(e) {}
}
setInterval(heartbeatPresence, 20000);
setInterval(refreshOnlineCounter, 20000);
setInterval(refreshZonePlayerCounts, 20000);
setInterval(refreshAdminZone, 20000);
refreshAdminZone();
setInterval(refreshVeliaPlayers, 20000);
setInterval(refreshLiveBoss, 20000);
refreshRegisteredCounter();
setInterval(refreshRegisteredCounter, 5 * 60000);

async function openAccountPanel() {
  if (!sb || !currentUser) return;
  if (isGuest()) {
    openInfo(LANG==='fr' ? '👤 Mon compte' : '👤 My account', `
      <p>${LANG==='fr'
        ? 'Tu joues en mode invité. Lie un compte vérifié (bouton "🔗 Lier un compte") pour accéder au parrainage, au marché et au classement — ta progression actuelle sera conservée.'
        : 'You\'re playing as a guest. Link a verified account (the "🔗 Link account" button) to access referrals, the market and the leaderboard — your current progress will be kept.'}</p>
      <h3>🧹 ${LANG==='fr'?'Cache du jeu':'Game cache'}</h3>
      <p class="mHint">${LANG==='fr'
        ? 'En cas d\'affichage étrange après une mise à jour, ce bouton vide le cache du navigateur pour les fichiers du jeu puis recharge la page. Ta progression n\'est jamais touchée.'
        : 'If something looks wrong after an update, this button clears the browser\'s cache for the game\'s files then reloads the page. Your progress is never affected.'}</p>
      <button id="btnClearCache">🧹 ${LANG==='fr'?'Vider le cache et recharger':'Clear cache and reload'}</button>
    `);
    $a('btnClearCache').onclick = clearGameCache;
    return;
  }
  let code = '', count = 0, referrals = [];
  try { const { data } = await sb.rpc('ensure_referral_code'); code = data || ''; } catch(e) {}
  try { const { data } = await sb.rpc('get_referral_count'); count = data || 0; } catch(e) {}
  try { const { data } = await sb.rpc('get_my_referrals'); referrals = data || []; } catch(e) {}

  const refRows = referrals.map(r => `
    <tr><td>${escapeHtml(r.display_name||'?')}</td><td>${r.lvl}</td><td>${fmt(r.gearscore)}</td><td>${fmt(r.silver)}</td></tr>
  `).join('') || `<tr><td colspan="4" class="admEmpty">${LANG==='fr'?'Aucun filleul pour l\'instant':'No referrals yet'}</td></tr>`;

  const rules = LANG==='fr' ? [
    'Un compte ne peut être parrainé qu\'une seule fois.',
    'Le parrainage doit se faire dans les 3 jours suivant la création du compte du filleul — impossible passé ce délai.',
    'Impossible d\'utiliser ton propre code.',
    'Impossible de parrainer ton propre parrain.',
    'Pas de récompense pour l\'instant — juste un suivi de qui tu as parrainé.',
  ] : [
    'An account can only be referred once.',
    'Referring must happen within 3 days of the referred account\'s creation — impossible afterward.',
    'You cannot use your own code.',
    'You cannot refer your own referrer.',
    'No reward for now — this is just a tracker of who you\'ve referred.',
  ];

  const hasDiscord = !!discordIdentity(currentUser);

  const html = `
    <div class="admSummary">${LANG==='fr'?'Compte':'Account'} : <b>${currentUser.email || '—'}</b></div>

    <h3>${LANG==='fr'?'📛 Pseudo':'📛 Nickname'}</h3>
    <p class="mHint">${LANG==='fr'
      ? 'Visible partout dans le classement. Le changer met à jour la même ligne, ça n\'en recrée jamais une nouvelle.'
      : 'Shown everywhere in the leaderboard. Changing it updates the same row, it never creates a new one.'}</p>
    <input type="text" id="pseudoInput" value="${myPseudo || ''}" maxlength="20">
    <button id="btnSavePseudo">${LANG==='fr'?'Enregistrer':'Save'}</button>
    <div id="pseudoMsg"></div>

    <h3>💬 Discord</h3>
    ${hasDiscord
      ? `<p class="mHint">${LANG==='fr'?'✅ Compte Discord connecté.':'✅ Discord account connected.'}</p>`
      : `<button id="btnLinkDiscord" class="discordBtn">🎮 ${LANG==='fr'?'Connecter Discord':'Connect Discord'}</button>`}

    <h3>${LANG==='fr'?'🎁 Parrainage':'🎁 Referrals'}</h3>
    <div id="refCodeBox">${code}</div>
    <button id="btnCopyRefCode">${LANG==='fr'?'📋 Copier le code':'📋 Copy code'}</button>
    <div class="admSummary" style="margin-top:14px">${LANG==='fr'?'Tu as un code d\'un autre joueur ?':'Got someone else\'s code?'}</div>
    <input type="text" id="refCodeInput" placeholder="${LANG==='fr'?'Code de parrainage':'Referral code'}" maxlength="12">
    <button id="btnApplyRefCode">${LANG==='fr'?'Valider':'Apply'}</button>
    <div id="refMsg"></div>
    <ul class="refRules">${rules.map(r => `<li>${r}</li>`).join('')}</ul>

    <h3>${LANG==='fr'?'👥 Tes filleuls':'👥 Your referrals'} (<span style="color:var(--gold)">${count}</span>)</h3>
    <table class="admTable">
      <thead><tr><th>${LANG==='fr'?'Joueur':'Player'}</th><th>${LANG==='fr'?'Niv.':'Lvl'}</th><th>GS</th><th>Silver</th></tr></thead>
      <tbody>${refRows}</tbody>
    </table>

    <h3>🧹 ${LANG==='fr'?'Cache du jeu':'Game cache'}</h3>
    <p class="mHint">${LANG==='fr'
      ? 'En cas d\'affichage étrange après une mise à jour, ce bouton vide le cache du navigateur pour les fichiers du jeu puis recharge la page. Ta progression n\'est jamais touchée.'
      : 'If something looks wrong after an update, this button clears the browser\'s cache for the game\'s files then reloads the page. Your progress is never affected.'}</p>
    <button id="btnClearCache">🧹 ${LANG==='fr'?'Vider le cache et recharger':'Clear cache and reload'}</button>

  `;
  openInfo(LANG==='fr' ? '👤 Mon compte' : '👤 My account', html);
  $a('btnClearCache').onclick = clearGameCache;
  $a('btnSavePseudo').onclick = async () => {
    const val = $a('pseudoInput').value.trim();
    const msg = $a('pseudoMsg');
    const { error } = await sb.rpc('set_pseudo', { p_pseudo: val });
    if (error) { msg.textContent = error.message; msg.className = 'fail'; return; }
    myPseudo = val;
    updatePseudoDisplay();
    msg.textContent = LANG==='fr'?'Pseudo enregistré !':'Nickname saved!'; msg.className = 'ok';
    syncPlayerStats(); 
  };
  if (!hasDiscord) $a('btnLinkDiscord').onclick = linkDiscordAccount;
  $a('btnCopyRefCode').onclick = async () => {
    try { await navigator.clipboard.writeText(code); } catch(e) {}
    $a('btnCopyRefCode').textContent = LANG==='fr' ? '✓ Copié !' : '✓ Copied!';
  };
  $a('btnApplyRefCode').onclick = async () => {
    const val = $a('refCodeInput').value.trim();
    const msg = $a('refMsg');
    if (!val) { msg.textContent = LANG==='fr'?'Entre un code.':'Enter a code.'; msg.className = 'fail'; return; }
    const { error } = await sb.rpc('apply_referral_code', { p_code: val });
    if (error) { msg.textContent = error.message; msg.className = 'fail'; return; }
    msg.textContent = LANG==='fr'?'Code appliqué !':'Code applied!'; msg.className = 'ok';
  };
}
$a('btnAccount').onclick = openAccountPanel;

let cloudSaveInterval = null;
function startAutoCloudSave() {
  if (cloudSaveInterval) clearInterval(cloudSaveInterval);
  cloudSaveInterval = setInterval(saveToCloud, 30000);
  window.addEventListener('beforeunload', saveToCloud);
}

setInterval(async () => { if (sb && currentUser && !document.hidden) { try { await sb.rpc('log_playtime_ping'); } catch(e) {} } }, 60000);

$a('btnSignIn').onclick = doSignIn;
$a('btnSignUp').onclick = doSignUp;
$a('btnForgotPass').onclick = doForgotPassword;
document.querySelectorAll('.authLangBtn').forEach(b => {
  b.onclick = () => {
    LANG = b.dataset.lang;
    try { localStorage.setItem('velia-idle-lang', LANG); } catch(e) {}
    applyI18n();
  };
});
$a('btnSignInDiscord').onclick = doSignInDiscord;
$a('btnClearCacheAuth').onclick = clearGameCache;
$a('btnLogout').onclick = doLogout;
$a('btnCopyUuid').onclick = async () => {
  if (!currentUser) return;
  try { await navigator.clipboard.writeText(currentUser.id); } catch(e) {}
  const hint = $a('uuidCopyHint'); if (!hint) return;
  hint.innerHTML = LANG==='fr' ? '✓ UUID copié !' : '✓ UUID copied!';
  setTimeout(() => { hint.innerHTML = '📋 ' + (LANG==='fr'?'Copier':'Copy') + ' UUID'; }, 1200);
};
$a('btnLinkAccount').onclick = () => {
  
  $a('authSub').textContent = LANG==='fr'
    ? 'Compte existant ? clique "Se connecter". Sinon "Créer un compte" (remplace ta progression invité).'
    : 'Existing account? click "Sign in". Otherwise "Create account" (replaces your guest progress).';
  showAuthOverlay(true);
};
$a('closeAuth').onclick = () => showAuthOverlay(false);
let authMouseDownOnBackdrop = false;
$a('authOverlay').addEventListener('mousedown', e => { authMouseDownOnBackdrop = (e.target.id === 'authOverlay'); });
$a('authOverlay').addEventListener('click', e => { if (e.target.id === 'authOverlay' && authMouseDownOnBackdrop && currentUser) showAuthOverlay(false); });
$a('authPass').addEventListener('keydown', e => { if (e.key === 'Enter') doSignIn(); });

(async () => {
  if (!sb) { showAuthOverlay(false); updateUserBar(); authShow(''); saveReady = true; return; } 
  const { data } = await sb.auth.getSession();
  if (data.session) onAuthed(data.session.user);
  else await startGuestOrShowAuth();
})();

const I18N = {
  btnWiki: { fr:'📖 Wiki', en:'📖 Wiki' },
  btnNotifCenter: { fr:'🔔 Notifications', en:'🔔 Notifications' },
  btnPatch: { fr:'📜 Notes de version', en:'📜 Patch Notes' },
  btnMarketLbl: { fr:'🏛️ Marché commun', en:'🏛️ Common Market' },
  marketConstructionBanner: { fr:'🚧 BETA — Marché en construction, encore peu fonctionnel : bugs et changements à prévoir', en:'🚧 BETA — Market under construction, still not very functional: expect bugs and changes' },
  btnLogout: { fr:'🚪 Déconnexion', en:'🚪 Log out' },
  authMobileBadge: { fr:'📱 BETA — Compatible mobile & tablette', en:'📱 BETA — Mobile & tablet compatible' },
  authSub: { fr:'Connecte-toi avec un vrai compte pour accéder au Marché et au Classement', en:'Sign in with a real account to access the Market and Leaderboard' },
  btnLinkAccount: { fr:'🔗 Lier un compte', en:'🔗 Link account' },
  btnAccount: { fr:'👤 Mon compte', en:'👤 My account' },
  onlineLbl: { fr:'en ligne', en:'online' },
  registeredLbl: { fr:'inscrits', en:'registered' },
  demoNoteAuth: { fr:'🎮 Ceci est une démo de test — ta progression peut être réinitialisée à tout moment.', en:'🎮 This is a test demo — your progress can be reset at any time.' },
  demoTag: { fr:'DÉMO', en:'DEMO' },
  devBannerText: { fr:'Jeu en développement — du contenu et des ajustements arrivent régulièrement', en:'Game in development — content and adjustments arrive regularly' },
  btnResetDemo: { fr:'🔄 Réinitialiser', en:'🔄 Reset' },
  btnResetMyQuests: { fr:'🔄 Réinitialiser mes quêtes', en:'🔄 Reset my quests' },
  btnResetAllQuests: { fr:'⚠️ Réinitialiser les quêtes de tous', en:'⚠️ Reset everyone\'s quests' },
  btnAdmin: { fr:'🛠️ Admin', en:'🛠️ Admin' },
  adminBoxTitle: { fr:'🛠️ Admin', en:'🛠️ Admin' },
  footerText: { fr:"Projet de fan gratuit, non officiel et fourni tel quel, sans garantie ni responsabilité (bugs, pertes de progression, interruptions...) — utilisation à tes risques. Noms/styles inspirés de Black Desert (propriété de Pearl Abyss le cas échéant) ; visuels 100% originaux, aucune affiliation.", en:"Free, unofficial fan project provided as-is, with no warranty or liability (bugs, progress loss, downtime...) — use at your own risk. Names/styles inspired by Black Desert (Pearl Abyss's property where applicable); visuals are 100% original, no affiliation." },
  authPassPh: { fr:'Mot de passe', en:'Password' },
  authPseudoPh: { fr:'Pseudo (pour la création de compte)', en:'Nickname (for account creation)' },
  btnSignIn: { fr:'Se connecter', en:'Sign in' },
  btnSignUp: { fr:'Créer un compte', en:'Create account' },
  btnForgotPass: { fr:'Mot de passe oublié ?', en:'Forgot password?' },
  btnSignInDiscord: { fr:'🎮 Se connecter avec Discord', en:'🎮 Sign in with Discord' },
  btnClearCacheAuth: { fr:'🧹 Vider le cache du jeu', en:'🧹 Clear game cache' },
  btnCodex: { fr:'📚 Codex', en:'📚 Codex' },
  tabCommon: { fr:'Marché commun', en:'Common Market' },
  commonHint: { fr:'Vrai carnet d\'ordres entre joueurs : pose un prix d\'achat ou de vente, l\'argent/l\'objet reste bloqué tant que l\'ordre n\'est pas exécuté ou annulé. Si ton prix correspond au meilleur ordre opposé, l\'échange se fait automatiquement (égalité de prix = tirage au sort).',
    en:'Real order book between players: set a buy or sell price, the money/item stays locked until the order is filled or cancelled. If your price matches the best opposite order, the trade happens automatically (tied prices = random draw).' },
  cmMyOrdersTitle: { fr:'📋 Mes ordres', en:'📋 My orders' },
  cmTabBrowse: { fr:'🛒 Parcourir', en:'🛒 Browse' },
  cmTabOrders: { fr:'📋 Mes ordres', en:'📋 My orders' },
  cmSelectItemHint: { fr:'Clique un objet pour voir le détail', en:'Click an item to see the detail' },
  cmWalletLbl: { fr:'💰 Ton solde', en:'💰 Your balance' },
  cardStats: { fr:'Statistiques', en:'Stats' },
  statsTabPerso: { fr:'Perso', en:'Personal' },
  statsTabReco: { fr:'Recommandations', en:'Recommendations' },
  statsTabLevels: { fr:'Niveaux', en:'Levels' },
  cardZoneStats: { fr:'Stats de la zone de farm', en:'Farming zone stats' },
  
  lblPS: { fr:'Gearscore', en:'Gearscore' }, lblPSAbbr: { fr:'GS', en:'GS' },
  lblPA: { fr:'Attaque effective', en:'Attack effective' }, lblPAAbbr: { fr:'PA', en:'AP' },
  lblPD: { fr:'Défense', en:'Defense' }, lblPDAbbr: { fr:'PD', en:'DP' },
  lblHpMax: { fr:'Vie max', en:'Max health' }, lblHpMaxAbbr: { fr:'PV', en:'HP' },
  lblMpMax: { fr:'Mana max', en:'Max mana' }, lblMpMaxAbbr: { fr:'MP', en:'MP' },
  lblSpd: { fr:'Vitesse', en:'Speed' }, lblSpdAbbr: { fr:'SPD', en:'SPD' },
  lblDodge: { fr:'Esquive', en:'Dodge' }, lblDodgeAbbr: { fr:'ESQ', en:'EVA' },
  lblApZone: { fr:'PA requis (zone)', en:'AP required (zone)' },
  lblDpZone: { fr:'PD requis (zone)', en:'DP required (zone)' },
  lblWeaponBonus: { fr:'Bonus arme', en:'Weapon bonus' }, lblWeaponBonusAbbr: { fr:'ATK', en:'ATK' },
  lblArmorBonus: { fr:'Bonus armure (moy.)', en:'Armor bonus (avg)' }, lblArmorBonusAbbr: { fr:'DEF', en:'DEF' },
  lblAiMode: { fr:'Mode de combat', en:'Combat mode' }, lblAiModeAbbr: { fr:'IA', en:'AI' },
  lblKpm: { fr:'Kills / min', en:'Kills / min' },
  lblKills: { fr:'Monstres tués', en:'Monsters slain' },
  lblLootCount: { fr:'Objets ramassés', en:'Items looted' },
  cardZones: { fr:'Zones de farm', en:'Farming zones' },
  cardLoot: { fr:'Loot de cette zone', en:'Loot in this zone' },
  cardEquip: { fr:'Équipement', en:'Equipment' },
  
  btnEquipBest: { fr:'⚡ Équiper meilleur', en:'⚡ Equip best' },
  btnSellWorse: { fr:'🗑️ Vendre', en:'🗑️ Sell worse' },
  resetNoticeClose: { fr:'OK, compris !', en:'OK, got it!' },
  invFullBanner: { fr:'⚠ Sac plein — les objets restent au sol', en:'⚠ Bag full — items stay on the ground' },
  dangerBanner: { fr:'⚠️ Zone dangereuse — montez votre stuff ou passez par une zone plus facile', en:'⚠️ Dangerous zone — upgrade your gear or move to an easier zone' },
  updateAvailableMsg: { fr:'🔄 Une nouvelle version du jeu est disponible.', en:'🔄 A new version of the game is available.' },
  btnReloadUpdate: { fr:'Recharger', en:'Reload' },
  btnLeaderboard: { fr:'🏆 Classement', en:'🏆 Leaderboard' },
  btnAchievements: { fr:'🏅 Succès', en:'🏅 Achievements' },
  btnCompendium: { fr:'📖 Compendium', en:'📖 Compendium' },
  btnDailyQuests: { fr:'🗒️ Quêtes', en:'🗒️ Quests' },
  btnMailbox: { fr:'📬 Courrier', en:'📬 Mailbox' },
  btnActivities: { fr:'Activités', en:'Activities' },
  copyLabel: { fr:'Copier', en:'Copy' },
  bossTopTitle: { fr:'🏆 Top contributeurs', en:'🏆 Top contributors' },
  bossPageTitle: { fr:'World Boss', en:'World Boss' },
  menuSideLeft: { fr:'◀ Gauche', en:'◀ Left' },
  menuSideRight: { fr:'Droite ▶', en:'Right ▶' },
  cardInv: { fr:'Inventaire', en:'Inventory' },
  lblLevel: { fr:'Niv.', en:'Lvl' },
  btnAutoSellLoot: { fr:'Vente automatique', en:'Auto-sell' },
  btnEquipSellCompendium: { fr:'⚡ Équiper → 🗑️ Vendre → 📖 Compendium', en:'⚡ Equip → 🗑️ Sell → 📖 Compendium' },
  
  btnDonation: { fr:'💖 Soutenir', en:'💖 Support' },
  lootPanelTabLoot: { fr:'🎒 Loot', en:'🎒 Loot' },
  lootPanelTabChest: { fr:'🏛️ Coffre', en:'🏛️ Chest' },
  cmTabMaterials: { fr:'📊 Matériaux', en:'📊 Materials' },
  mktChartHead: { fr:'Graphique chandelier — 20 dernières transactions', en:'Candlestick chart — last 20 trades' },
  mktSideBuy: { fr:'Achat', en:'Buy' },
  mktSideSell: { fr:'Vente', en:'Sell' },
  mktPriceLbl: { fr:'Prix unitaire', en:'Unit price' },
  mktQtyLbl: { fr:'Quantité', en:'Quantity' },
  mktPlaceBuy: { fr:"Placer l'ordre d'achat", en:'Place buy order' },
  mktHistHead: { fr:'📜 Historique des transactions', en:'📜 Transaction history' },
  lblWeight: { fr:'Poids', en:'Weight' },
  cardOpt: { fr:'Optimisation', en:'Enhancement' },
  invModeInv: { fr:'🎒 Inventaire', en:'🎒 Inventory' },
  invModeCraft: { fr:'🔧 Assemblage', en:'🔧 Craft' },
  invModeCompendium: { fr:'📖 Compendium', en:'📖 Compendium' },
  compGridEmpty: { fr:'Aucun objet protégé pour l\'instant', en:'No protected item yet' },
  optChanceEmpty: { fr:'Chargez un matériau depuis le sac', en:'Load a material from your bag' },
  optCronToggleLbl: { fr:'Utiliser la Pierre de Cron si dispo', en:'Use Cron Stone if available' },
  btnOptTry: { fr:"Tenter l'optimisation", en:'Attempt enhancement' },
  btnOptAuto: { fr:"▶ Auto jusqu'à", en:'▶ Auto to' },
  optAutoModeTarget: { fr:"Jusqu'à un palier", en:'Until a target level' },
  optAutoModeNextGain: { fr:"Jusqu'au prochain gain de PA/PD", en:'Until the next AP/DP gain' },
  optAutoModeLoop: { fr:"En boucle (jusqu'à rupture de matériau)", en:'On loop (until out of material)' },
  optAutoModeFail: { fr:"Jusqu'au premier échec", en:'Until the first failure' },
  optAutoModeCron: { fr:"Jusqu'à épuisement des Pierres de Cron", en:'Until out of Cron Stones' },
  btnConvertCaphras: { fr:'Convertir (5:1)', en:'Convert (5:1)' },
  naderrLbl: { fr:'Bandeau de Naderr', en:"Naderr's Band" },
};
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (I18N[key]) el.textContent = I18N[key][LANG];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.getAttribute('data-i18n-ph');
    if (I18N[key]) el.setAttribute('placeholder', I18N[key][LANG]);
  });
  $a('langThumb').classList.toggle('en', LANG === 'en');
  document.querySelectorAll('.langOpt').forEach(el => el.classList.toggle('active', el.dataset.lang === LANG));
  document.querySelectorAll('.authLangBtn').forEach(el => el.classList.toggle('active', el.dataset.lang === LANG));
  document.documentElement.lang = LANG;
  refreshInvUI(); 
  hudFast();
}
$a('langToggle').onclick = () => {
  LANG = LANG === 'fr' ? 'en' : 'fr';
  try { localStorage.setItem('velia-idle-lang', LANG); } catch(e) {}
  applyI18n();
};

let menuSide = 'left';
try { menuSide = localStorage.getItem('velia-idle-menuside') || 'left'; } catch(e) {}
function applyMenuSide() {
  $a('sideMenu').classList.toggle('onRight', menuSide === 'right');
  $a('menuSideThumb').classList.toggle('right', menuSide === 'right');
  document.querySelectorAll('.menuSideOpt').forEach(el => el.classList.toggle('active', el.dataset.side === menuSide));
}
$a('menuSideToggle').onclick = () => {
  menuSide = menuSide === 'left' ? 'right' : 'left';
  try { localStorage.setItem('velia-idle-menuside', menuSide); } catch(e) {}
  applyMenuSide();
};
applyMenuSide();

let sideMenuCollapsed = isMobileViewport();
try {
  const saved = localStorage.getItem('velia-idle-menu-collapsed');
  if (saved !== null) sideMenuCollapsed = saved === '1'; 
} catch(e) {}
function applyMenuCollapse() {
  $a('sideMenu').classList.toggle('collapsed', sideMenuCollapsed);
  $a('btnCollapseMenu').textContent = sideMenuCollapsed ? '▶' : '◀';
}
$a('btnCollapseMenu').onclick = () => {
  sideMenuCollapsed = !sideMenuCollapsed;
  try { localStorage.setItem('velia-idle-menu-collapsed', sideMenuCollapsed ? '1' : '0'); } catch(e) {}
  applyMenuCollapse();
};
applyMenuCollapse();

const CURRENT_VERSION = PATCH_NOTES[0].v;
$a('clientVersionNum').textContent = CURRENT_VERSION;
let updateToastShown = false;
async function checkForUpdate() {
  if (updateToastShown) return;
  try {
    
    const res = await fetch('./meta/patch-notes-data.js?_=' + Date.now(), { cache: 'no-store' });
    const text = await res.text();
    const m = text.match(/const PATCH_NOTES = \[\s*\{\s*v:\s*'([^']+)'/);
    if (m && m[1] !== CURRENT_VERSION) {
      updateToastShown = true;
      $a('updToastVer').textContent = '(' + m[1] + ')';
      $a('updateToast').classList.add('show');
    }
  } catch (e) {}
}
$a('btnReloadUpdate').onclick = () => location.reload();
// vide le cache du navigateur pour les fichiers du jeu (utile si une maj ne s'affiche pas

async function clearGameCache() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch (e) {}
  location.href = location.pathname + '?nocache=' + Date.now();
}
setInterval(checkForUpdate, 60 * 1000); 
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
window.addEventListener('focus', checkForUpdate);
setTimeout(checkForUpdate, 15000); 

const WIKI_SECTIONS = [
  { id:'combat', icon:'⚔️', label:{fr:'Combat & Zones',en:'Combat & Zones'},
    fr:`<h3>PA / PD par zone (comme dans le vrai jeu)</h3>
      <p>Chaque zone a un <b>PA requis</b> et un <b>PD requis</b> affichés directement. Les deux stats jouent des rôles séparés :</p>
      <ul>
        <li><b>Pas assez de PA</b> → tes sorts infligent moins de dégâts (jusqu'à -75% si très sous-PA)</li>
        <li><b>Pas assez de PD</b> → tu encaisses beaucoup plus de dégâts (jusqu'à 4,5×), risque de K.O. élevé</li>
        <li>Au-dessus des deux → dégâts et réduction bonus, plafonnés pour éviter le farm abusif</li>
        <li>Le loot suit le pire des deux ratios : ta pénalité de loot est calculée sur <b>le plus faible</b> de tes 2 ratios (PA effectif / PA requis, PD effectif / PD requis), jamais la moyenne ni le meilleur. Exemple : un PA parfait (ratio 1.5) mais un PD à moitié du requis (ratio 0.5) → ton loot est pénalisé <b>comme si tu étais à 0.5 partout</b>, le PA excédentaire ne compense rien. En dessous de <b>90%</b> du requis → loot réduit (jusqu'à -70%) ; dès <b>90%</b> du requis (pas besoin d'atteindre 100%) OU overstuff → loot toujours normal (100%), plus aucun bonus ni malus au-delà</li>
        <li><b>ZONE DANGEREUSE</b> (très sous-PA/PD) → tu es ralenti, et les monstres qui t'ont repéré deviennent plus rapides pour te rattraper</li>
      </ul>
      <h3>Mana</h3>
      <p>Chaque sort coûte de la mana, qui se régénère passivement même hors combat. Une potion de mana (auto-bue sous 30%) complète la potion de PV si tu es à court.</p>
      <h3>Loot progressif</h3>
      <p>Les taux de drop sont <b>volontairement décroissants</b> zone par zone : le matériau d'optimisation passe d'environ 55% en toute première zone à environ 5-7% en fin de jeu, les composants de craft endgame (Fragment de mémoire, Marbre du Dieu déchu...) descendent eux sous 1%.</p>
      <h3>Sac plein (192/192)</h3>
      <p>Le silver n'occupe jamais de place (toujours ramassé). Un matériau/bijou déjà en stack dans ton sac continue lui aussi d'être ramassé tant que ce stack n'est pas à son maximum, même sac plein. Seuls les <b>nouveaux</b> objets qui auraient besoin d'une case libre restent au sol — un bandeau rouge ⚠ t'en avertit, sans jamais t'empêcher de continuer à farmer.</p>
      <h3>Zones groupées par palier de stuff</h3>
      <p>Les 16 zones de Velia sont regroupées par palier d'équipement (Naru/gris, Tuvala/blanc, Yuria/vert, Grunil/bleu — 4 zones chacun) — la couleur de l'en-tête et de la bordure correspond à la couleur du stuff qu'on y trouve, la même que dans l'inventaire.</p>
      <p>Chaque zone garantit une seule pièce d'armure précise (casque/plastron/gants sur les 3 premières zones du palier, bottes sur la 4e) ; côté arme, 3 des 4 zones du palier garantissent chacune un type différent (arme principale/secondaire/éveil, jamais deux fois le même), seule la 2<sup>e</sup> zone du palier n'a aucune arme garantie. Clique l'icône 👁 d'une zone pour voir exactement laquelle.</p>
      <h3>Trésor de Velia</h3>
      <p>Toutes les zones de Velia peuvent aussi looter des morceaux du <b>Trésor de Velia</b> — 2 objets collectibles très rares (0,17% et 0,0005% par kill), rangés dans leur propre onglet d'inventaire 🗺️. 100 "Bout du trésor de Velia" se combinent (onglet Assemblage) en 1 "Trésor de Velia" complet, revendable à très haute valeur. Une recette secrète existe aussi (1 Trésor de Velia + 1 de Heidel + 1 de Calpheon → coffret bonus), mais reste hors de portée tant que Heidel/Calpheon ne sont pas débloqués.</p>
      <h3>Boss mondiaux partagés</h3>
      <p>Le <b>Kzarka</b> du planning horaire (12h45/19h45/23h45 tous les jours, 15h45 le week-end) a des <b>PV réellement partagés entre tous les joueurs</b>, exactement comme un boss lancé par l'admin : tout le monde tape le même pool de PV et se voit dans l'arène. Le <b>Vell</b>, boss hebdomadaire bien plus rare et plus coriace (jeudi 12h00 et dimanche 16h45 — horaires in-game, soit -15 min par rapport aux horaires réels garmoth.com de 12h15/17h00), fonctionne sur le même principe.</p>
      <h3>Où farmer un socle vide ?</h3>
      <p>Clique un socle d'équipement <b>vide</b> sur la poupée : la ou les zones qui lootent cet objet s'illuminent d'un halo doré dans la liste des zones, et un bouton te téléporte directement dessus. Une zone dangereuse pour ton stuff actuel n'est jamais proposée tant qu'une alternative plus sûre existe.</p>`,
    en:`<h3>AP / DP per zone (like the real game)</h3>
      <p>Every zone has a <b>required AP</b> and <b>required DP</b>. The two stats play separate roles:</p>
      <ul>
        <li><b>Not enough AP</b> → your spells deal less damage (up to -75%)</li>
        <li><b>Not enough DP</b> → you take a lot more damage (up to 4.5×), high KO risk</li>
        <li>Above both → bonus damage and reduction, capped to prevent overfarming</li>
        <li>Loot follows the worse of the two ratios: your loot penalty is calculated on <b>whichever is lowest</b> of your 2 ratios (effective AP / required AP, effective DP / required DP), never the average or the best one. Example: perfect AP (ratio 1.5) but DP at half the requirement (ratio 0.5) → your loot is penalized <b>as if you were at 0.5 everywhere</b>, the excess AP compensates for nothing. Below <b>90%</b> of the requirement → reduced loot (up to -70%); from <b>90%</b> of the requirement onward (no need to reach 100%) OR overgeared → loot always normal (100%), no bonus or penalty beyond that</li>
        <li><b>DANGEROUS ZONE</b> (very under-AP/DP) → you are slowed down, and monsters that spotted you become faster to catch up</li>
      </ul>
      <h3>Mana</h3>
      <p>Every skill costs mana, which regenerates passively even out of combat. A mana potion (auto-drunk under 30%) joins the HP potion if you run low.</p>
      <h3>Progressive loot</h3>
      <p>Drop rates are <b>intentionally decreasing</b> zone by zone: the enhancement material goes from about 55% in the very first zone down to about 5-7% at endgame, while endgame crafting components (Memory Fragment, Fallen God's Marble...) drop under 1%.</p>
      <h3>Full bag (192/192)</h3>
      <p>Silver never takes up space (always picked up). A material/jewelry already stacked in your bag keeps getting picked up as long as that stack isn't full, even with a full bag. Only <b>new</b> items that would need a free slot stay on the ground — a red ⚠ banner warns you, without ever stopping you from farming.</p>
      <h3>Zones grouped by gear tier</h3>
      <p>The 16 Velia zones are grouped by gear tier (Naru/grey, Tuvala/white, Yuria/green, Grunil/blue — 4 zones each) — the header and border color match the gear color found there, same as in the inventory.</p>
      <p>Every zone guarantees exactly one specific armor piece (helmet/armor/gloves on the tier's first 3 zones, boots on the 4th); for weapons, 3 of the tier's 4 zones each guarantee a different type (main/secondary/awakening, never the same type twice) — only the tier's 2<sup>nd</sup> zone has no guaranteed weapon. Click a zone's 👁 icon to see exactly which one.</p>
      <h3>Velia Treasure</h3>
      <p>All Velia zones can also drop pieces of the <b>Velia Treasure</b> — 2 very rare collectibles (0.17% and 0.0005% per kill), stored in their own 🗺️ inventory tab. 100 "Velia Treasure Piece" combine (Assembly tab) into 1 complete "Velia Treasure", sellable for a very high value. A secret recipe also exists (1 Velia Treasure + 1 Heidel Treasure + 1 Calpheon Treasure → bonus chest), but stays out of reach until Heidel/Calpheon are unlocked.</p>
      <h3>Shared world bosses</h3>
      <p>The scheduled <b>Kzarka</b> (12:45pm/7:45pm/11:45pm daily, 3:45pm on weekends) has <b>truly shared HP across all players</b>, exactly like an admin-spawned boss: everyone hits the same HP pool and is visible in the arena. The <b>Vell</b>, a much rarer and tougher weekly boss (Thursday 12:00pm and Sunday 4:45pm in-game — 15 minutes earlier than the real garmoth.com schedule of 12:15pm/5:00pm), works the same way.</p>
      <h3>Where to farm an empty slot?</h3>
      <p>Click an <b>empty</b> equipment slot on the paperdoll: the zone(s) that drop that item light up with a gold halo in the zone list, plus a button teleports you there directly. A zone too dangerous for your current gear is never suggested while a safer alternative exists.</p>` },
  { id:'enh', icon:'✦', label:{fr:'Optimisation',en:'Enhancement'},
    fr:`<h3>Enchantement</h3>
      <p>+1 à +7 toujours réussi. <b>+8 à +15</b> sont probabilistes (45% → 5%) et peuvent rétrograder en cas d'échec, mais jamais sous +7.</p>
      <p>Puis <b>PRI/DUO/TRI/TET/PEN</b> suivent des chances fixes (12%/9%/6%/3%/1,2%). À partir de PRI, un échec fait <b>rétrograder d'un palier</b> (ex : DUO → PRI) — mais <b>jamais sous PRI</b> : tu ne retombes plus jamais à +15.</p>
      <p>Pas de failstack caché : ce que tu vois à l'écran est la chance réelle. Chaque pièce a son propre niveau, indépendant.</p>
      <p>La <b>Poussière d'esprit ancien</b> ne sert pas à optimiser directement : c'est un composant pour fabriquer des Pierres de Caphras.</p>
      <p>La <b>Pierre de Cron</b> (1% de drop, 1 à 3 unités, toutes zones) protège d'une rétrogradation en cas d'échec — à toi de décider si tu veux l'utiliser via la case à cocher à côté du matériau chargé, elle n'est plus consommée automatiquement. Son coût dépend du palier de la pièce protégée : 1 (gris), 2 (blanc), 3 (vert), 4 (bleu).</p>
      <p>Astuce : clique le petit 🔧 sur une pièce équipée pour charger directement CETTE pièce dans le panneau d'optimisation.</p>`,
    en:`<h3>Enhancement</h3>
      <p>+1 to +7 always succeed. <b>+8 to +15</b> are probabilistic (45% → 5%) and can downgrade on failure, but never below +7.</p>
      <p>Then <b>PRI/DUO/TRI/TET/PEN</b> follow fixed chances (12%/9%/6%/3%/1.2%). From PRI, a failure <b>downgrades one tier</b> (e.g. DUO → PRI) — but <b>never below PRI</b>: you never drop back to +15.</p>
      <p>No hidden failstack: what you see is the real chance. Each piece has its own independent level.</p>
      <p><b>Ancient Spirit Dust</b> isn't used to enhance directly: it's a component to craft Caphras Stones.</p>
      <p>The <b>Cron Stone</b> (1% drop rate, 1 to 3 units, every zone) protects against a downgrade on failure — you decide whether to use it via the checkbox next to the loaded material, it's no longer consumed automatically. Its cost depends on the protected piece's tier: 1 (grey), 2 (white), 3 (green), 4 (blue).</p>
      <p>Tip: click the small 🔧 on an equipped piece to load THAT piece directly into the enhancement panel.</p>` },
  { id:'market', icon:'🏛️', label:{fr:'Marché',en:'Market'},
    fr:`<h3>🚧 BETA — en construction</h3>
      <p>Le Marché est encore <b>peu fonctionnel</b> : attends-toi à des bugs, des changements et des remises à zéro pendant son développement. Ne t'y fie pas encore pour ta progression.</p>
      <h3>Marché commun</h3>
      <p>Vrai carnet d'ordres : place un ordre d'achat ou de vente à ton prix, apparié automatiquement avec un ordre en face dès que les prix se croisent (pas de prix fixe imposé).</p>
      <p><b>Taxe de vente : 35%</b> — prélevée uniquement sur le vendeur, qui touche 65% du prix de vente ; l'acheteur paie toujours le prix affiché.</p>`,
    en:`<h3>🚧 BETA — under construction</h3>
      <p>The Market is still <b>not very functional</b>: expect bugs, changes and resets while it's being developed. Don't rely on it for your progress yet.</p>
      <h3>Common market</h3>
      <p>A real order book: place a buy or sell order at your own price, automatically matched with an opposing order once prices cross (no fixed price imposed).</p>
      <p><b>Sales tax: 35%</b> — charged only to the seller, who receives 65% of the sale price; the buyer always pays the listed price.</p>` },
  { id:'account', icon:'💾', label:{fr:'Compte & Sauvegarde',en:'Account & Save'},
    fr:`<h3>Sauvegarde</h3>
      <p>Sauvegarde cloud automatique toutes les 30 s, plus une sauvegarde locale de secours. En cas de déconnexion brutale, jusqu'à 30 s de progression peuvent être perdues.</p>
      <h3>Loyalties & Courrier</h3>
      <p>Tu reçois 200 Loyalties par jour dans ton 📬 Courrier — elles s'y empilent en permanence et ne se perdent jamais.</p>`,
    en:`<h3>Save system</h3>
      <p>Automatic cloud save every 30 s, plus a local backup. On an abrupt disconnect, up to 30 s of progress may be lost.</p>
      <h3>Loyalties & Mailbox</h3>
      <p>You get 200 Loyalties per day in your 📬 Mailbox — they stack there permanently and never get lost.</p>` },
  { id:'about', icon:'ℹ️', label:{fr:'À propos',en:'About'},
    
    fr:`<h3>Le jeu en un coup d'œil</h3>
      <p>Velia Idle est un jeu idle de farm automatique : ton personnage combat, loote et progresse seul dans des zones classées par palier de stuff (Naru/gris → Tuvala/blanc → Yuria/vert → Grunil/bleu), avec enchantement (+1 à PEN), un Compendium de collection à vie, 2 World Bosses partagés (Kzarka quotidien, Vell hebdomadaire), un Marché commun entre joueurs (taxe de vente 35%), un système de Loyalty (200/jour), un Trésor de Velia à assembler, une sauvegarde cloud, un classement et un chat — le tout géré par un backend Supabase.</p>
      <h3>Noms & identité visuelle</h3>
      <p>Les noms de zones, monstres et objets sont inspirés de Black Desert Online pour l'ambiance, tout comme certains styles de jeu et mécaniques — ils restent, le cas échéant, la propriété de Pearl Abyss. Les icônes et visuels, eux, sont des créations originales de style fan : ils s'inspirent visuellement du jeu mais ne réutilisent aucun asset réel.</p>
      <p>Black Desert ainsi que toutes les images, illustrations, icônes, noms et données du jeu sont la propriété de Pearl Abyss. Projet de fan non officiel et gratuit, sans aucune affiliation ni partenariat avec Pearl Abyss.</p>`,
    en:`<h3>The game at a glance</h3>
      <p>Velia Idle is an automatic idle-farming game: your character fights, loots and progresses on its own through zones ranked by gear tier (Naru/grey → Tuvala/white → Yuria/green → Grunil/blue), with enhancement (+1 to PEN), a lifetime-collection Compendium, 2 shared World Bosses (daily Kzarka, weekly Vell), a player-to-player Common Market (35% sales tax), a Loyalty system (200/day), an assemblable Velia Treasure, cloud saves, a leaderboard and chat — all backed by Supabase.</p>
      <h3>Names & visual identity</h3>
      <p>Zone, monster and item names are inspired by Black Desert Online for atmosphere, as are some game styles and mechanics — these remain, where applicable, the property of Pearl Abyss. Icons and visuals, on the other hand, are original fan-style creations: visually inspired by the game but reusing no real assets.</p>
      <p>Black Desert, along with all in-game images, illustrations, icons, names and data, is the property of Pearl Abyss. Unofficial, free fan project, with no affiliation or partnership with Pearl Abyss.</p>` },
  { id:'tuto', icon:'🔰', label:{fr:'Tutoriel',en:'Tutorial'}, tuto:true },
];

function renderCodexHtml() {
  const seen = new Set();
  const section = (title, items) => {
    if (!items.length) return '';
    return `<h3>${title}</h3>` + items.map(it =>
      `<div class="codexRow"><div class="codexIcon">${it.icon}</div>` +
      `<div class="codexInfo"><div class="codexName">${it.name}</div>` +
      `<div class="codexDesc">${it.desc}</div></div></div>`).join('');
  };
  
  const jewels = ZONES.map((z,i) => {
    const t = gearTierForZone(i), slot = accSlotFor(z.loot.jackpot), tIdx = JEWEL_TIER_IDX[t.grade] ?? 0;
    const iconFn = { ring:ringIconForTier, necklace:necklaceIconForTier, earring:earringIconForTier, belt:beltIconForTier }[slot] || ringIconForTier;
    return { icon: iconFn(tIdx, t.color), name:tr(z.loot.jackpot.name),
      desc:`+${z.loot.jackpot.ap} PA · ${LANG==='fr'?'zone':'zone'} ${i+1} (${tr(z.name)})` };
  });
  
  const matSet = new Map();
  ZONES.forEach(z => { const m = z.loot.mat; if (!matSet.has(m.name)) matSet.set(m.name, m); });
  const MAT_ICON_BY_NAME = { 'Pierre de Novice':ICO_MAT_NOVICE, 'Pierre du Temps':ICO_MAT_TEMPS,
    'Pierre Noire':ICO_MAT_NOIRE, 'Pierre noire':ICO_MAT_NOIRE, 'Pierre concentrée':ICO_MAT_CONCENTREE,
    'Pierre de Caphras':ICO_MAT_CAPHRAS };
  const mats = [...matSet.values()].map(m => ({ icon:MAT_ICON_BY_NAME[m.name]||ICO_MAT_NOVICE, name:tr(m.name), desc:LANG==='fr'?'Matériau d\'optimisation':'Enhancement material' }));
  
  const craftSet = new Map();
  ZONES.forEach(z => { const c = z.loot.craft; if (!craftSet.has(c.name)) craftSet.set(c.name, c); });
  const crafts = [...craftSet.values()].map(c => ({ icon:'✦', name:tr(c.name), desc:LANG==='fr'?'Composant de craft endgame':'Endgame crafting component' }));
  
  const trash = ZONES.map((z,i) => ({ icon:'▬', name:tr(z.loot.trash.name), desc:`${fmt(z.loot.trash.val)} silver · ${tr(z.mob)}` }));
  
  const treasures = VELIA_TREASURE.map(t =>
    ({ icon:t.icon, name:tr(t.name), desc:`${LANG==='fr'?'Toutes zones':'All zones'} · ${fmtTinyPct(t.ch)}` }));
  return `<div class="admSummary">${LANG==='fr'?'Tous les objets actuellement présents dans le jeu.':'All items currently in the game.'}</div>` +
    section(LANG==='fr'?'💎 Bijoux rares':'💎 Rare jewelry', jewels) +
    section(LANG==='fr'?'◈ Matériaux d\'optimisation':'◈ Enhancement materials', mats) +
    section(LANG==='fr'?'✦ Composants de craft':'✦ Crafting components', crafts) +
    section(LANG==='fr'?'🗺️ Trésor de Velia':'🗺️ Velia Treasure', treasures) +
    section(LANG==='fr'?'▬ Butin de base':'▬ Base loot', trash);
}

function renderTutoPageHtml() {
  return `<div class="admSummary">${LANG==='fr'
    ? 'Le tutoriel te fait visiter Velia, la ville paisible, et t\'explique les bases du jeu (zones, sorts automatiques, statistiques, quêtes, chat). Tu peux le relancer ici quand tu veux.'
    : 'The tutorial walks you through Velia, the peaceful town, and explains the basics of the game (zones, automatic skills, stats, quests, chat). You can replay it here anytime.'}</div>
    <button id="btnStartTutoWiki" style="width:auto;margin-top:10px;padding:8px 18px;">${LANG==='fr'?'▶ Relancer le tutoriel':'▶ Replay the tutorial'}</button>`;
}
let wikiSection = 'combat';
function renderWikiHtml() {
  const tabsHtml = WIKI_SECTIONS.map(s =>
    `<button class="catTab wikiTab${s.id===wikiSection?' active':''}" data-sec="${s.id}">${s.icon} ${s.label[LANG]}</button>`).join('');
  const sec = WIKI_SECTIONS.find(s => s.id === wikiSection) || WIKI_SECTIONS[0];
  const body = sec.codex ? renderCodexHtml() : sec.tuto ? renderTutoPageHtml() : sec[LANG];
  return `<div class="catTabs">${tabsHtml}</div><div class="wikiBody">${body}</div>`;
}

function openInfo(title, bodyHtml) {
  questsPanelOpen = false; 
  $a('infoTitle').textContent = title;
  $a('infoBody').innerHTML = bodyHtml;
  $a('infoOverlay').classList.add('open');
  
  if (typeof updatePatchBadge === 'function') updatePatchBadge();
}
$a('closeInfo').onclick = () => { questsPanelOpen = false; $a('infoOverlay').classList.remove('open'); updatePatchBadge(); };

let infoMouseDownOnBackdrop = false;
$a('infoOverlay').addEventListener('mousedown', e => { infoMouseDownOnBackdrop = (e.target.id === 'infoOverlay'); });
$a('infoOverlay').addEventListener('click', e => { if (e.target.id === 'infoOverlay' && infoMouseDownOnBackdrop) { questsPanelOpen = false; $a('infoOverlay').classList.remove('open'); updatePatchBadge(); } });

$a('btnCodex').onclick = () => {
  const callout = contentChangeCalloutHtml('codex');
  openInfo(LANG === 'fr' ? '📚 Codex des objets' : '📚 Item Codex', callout + renderCodexHtml());
  markContentSeen('codex');
};
$a('btnWiki').onclick = () => {
  const callout = contentChangeCalloutHtml('wiki');
  openInfo(LANG === 'fr' ? '📖 Wiki' : '📖 Wiki', callout + renderWikiHtml());
  markContentSeen('wiki');
  $a('infoBody').querySelectorAll('.wikiTab').forEach(btn => {
    btn.onclick = () => { wikiSection = btn.dataset.sec; $a('btnWiki').onclick(); };
  });
  const tutoBtn = $a('btnStartTutoWiki');
  if (tutoBtn) tutoBtn.onclick = () => { $a('infoOverlay').classList.remove('open'); startTutorial(); };
};

let tutTrackerWasOn = false, tutTrackerForced = false;
let tutPotWasOpen = false;
const TUTORIAL_STEPS = [
  { title:{fr:'Bienvenue à Velia !',en:'Welcome to Velia!'},
    text:{fr:'Velia est une ville paisible : aucun monstre n\'y rôde. C\'est le meilleur endroit pour découvrir les bases avant de partir à l\'aventure.', en:'Velia is a peaceful town: no monsters roam here. It\'s the best place to learn the basics before heading out to adventure.'} },
  { target:'#activityTabs', placement:'bottom',
    title:{fr:'Les pages du jeu',en:'Game pages'},
    text:{fr:'Cette barre te permet de basculer entre les activités : la Zone (farm) et le Boss mondial. D\'autres activités arriveront plus tard.', en:'This bar lets you switch between activities: the Zone (farming) and the World Boss. More activities will arrive later.'} },
  { target:'#zoneList', placement:'left',
    title:{fr:'Choisis ta zone de farm',en:'Pick your farming zone'},
    text:{fr:'Clique une zone pour t\'y rendre. Ton personnage combat AUTOMATIQUEMENT — pas besoin de cliquer pour attaquer !', en:'Click a zone to travel there. Your character fights AUTOMATICALLY — no need to click to attack!'} },
  { target:'#skillBar', placement:'top',
    title:{fr:'Sorts automatiques',en:'Automatic skills'},
    text:{fr:'Tes sorts se lancent tout seuls selon une IA de combat. Optimise ton équipement pour qu\'ils tapent plus fort.', en:'Your skills cast themselves based on a combat AI. Improve your gear so they hit harder.'} },
  { target:'#potSlot', placement:'right',
    title:{fr:'Potions de vie et de mana',en:'HP and mana potions'},
    text:{fr:'Clique ici pour choisir la taille de potion de vie bue automatiquement (prix fixe et soin différents selon la taille) et régler le seuil "Boire sous X%". La potion de mana se boit toute seule sous 30% mana, aucun réglage nécessaire.', en:'Click here to choose the HP potion size drunk automatically (fixed price and heal that differ by size) and set the "Drink under X%" threshold. The mana potion drinks itself under 30% mana, no setting needed.'},
    before: () => { tutPotWasOpen = $a('potSelect').classList.contains('show'); renderPotSelect(); $a('potSelect').classList.add('show'); },
    after: () => { if (!tutPotWasOpen) $a('potSelect').classList.remove('show'); } },
  { target:'#panel .card', placement:'left',
    title:{fr:'Tes statistiques',en:'Your stats'},
    text:{fr:'Gearscore, PA/PD et progression : tout ce qu\'il faut pour savoir si tu es prêt pour la zone suivante.', en:'Gearscore, AP/DP and progress: everything you need to know if you\'re ready for the next zone.'} },
  { target:'#optCard', placement:'left',
    title:{fr:'Système d\'optimisation',en:'Enhancement system'},
    text:{fr:'Charge un matériau depuis ton sac pour tenter d\'améliorer une pièce d\'équipement. Plus le niveau visé est haut, plus le risque d\'échec est grand. Astuce : le petit 🔧 sur une pièce équipée t\'amène directement ici pour CETTE pièce.', en:'Load a material from your bag to try enhancing a gear piece. The higher the target level, the higher the risk of failure. Tip: the small 🔧 on an equipped piece brings you straight here for THAT piece.'} },
  { target:'#invCard', placement:'left',
    title:{fr:'Ton inventaire',en:'Your inventory'},
    text:{fr:'Tout ce que tu ramasses atterrit ici. Les boutons au-dessus t\'aident à équiper le meilleur stuff, vendre le surplus (trash, matériaux, objets inférieurs) ou trier le sac en un clic.', en:'Everything you loot lands here. The buttons above help you equip your best gear, sell the surplus (trash, materials, lower items) or sort your bag in one click.'} },
  { target:'#btnEquipBest', placement:'bottom',
    title:{fr:'"Équiper le meilleur" = toujours le meilleur SOCLE',en:'"Equip best" = always the best BASE gear'},
    text:{fr:'Ce bouton compare le socle (stats de base) de chaque objet, pas ses stats actuelles à l\'écran. Une pièce de plus haut niveau reste donc TOUJOURS préférée à une pièce plus faible même très enchantée : c\'est ton futur BiS (Best in Slot), et l\'enchanter la rendra encore plus forte.', en:'This button compares each item\'s BASE stats, not what\'s currently shown on screen. A higher-tier piece is therefore ALWAYS preferred over a weaker one even if heavily enhanced: it\'s your future BiS (Best in Slot), and enhancing it will make it even stronger.'} },
  { target:'#lootTicker', placement:'left',
    title:{fr:'Le butin en direct',en:'Live loot'},
    text:{fr:'Ce que ton personnage ramasse défile ici, à droite de la zone de jeu, en temps réel.', en:'What your character loots scrolls here, on the right of the game view, in real time.'} },
  { target:'#btnDailyQuests', placement:'bottom',
    title:{fr:'Quêtes journalières & hebdo',en:'Daily & weekly quests'},
    text:{fr:'Clique ici pour voir tes quêtes. Des objectifs se renouvellent chaque jour et chaque semaine, avec des récompenses en silver à la clé.', en:'Click here to see your quests. Objectives refresh every day and every week, with silver rewards waiting for you.'} },
  { target:'#btnToggleTracker', placement:'bottom',
    title:{fr:'Suis tes quêtes',en:'Track your quests'},
    text:{fr:'Ce bouton ouvre le suivi des quêtes restantes : elles s\'affichent alors en permanence à l\'écran, avec leur progression en direct.', en:'This button opens the remaining quests tracker: they then show permanently on screen, with live progress.'},
    
    before: () => { openDailyQuests(); },
    after: () => { questsPanelOpen = false; $a('infoOverlay').classList.remove('open'); } },
  { target:'#questTrackerWidget', placement:'left',
    title:{fr:'Le suivi de quête',en:'The quest tracker'},
    text:{fr:'Voici où apparaissent les quêtes que tu suis, avec leur progression en direct — pratique pour ne rien oublier.', en:'This is where the quests you track appear, with live progress — handy so you never forget them.'},
    before: () => { tutTrackerWasOn = S.questTrackerOn; if (!S.questTrackerOn) { S.questTrackerOn = true; tutTrackerForced = true; renderQuestTrackerWidget(); } },
    after: () => { if (tutTrackerForced) { S.questTrackerOn = tutTrackerWasOn; tutTrackerForced = false; renderQuestTrackerWidget(); } } },
  { target:'#btnLeaderboard', placement:'bottom',
    title:{fr:'Le classement',en:'The leaderboard'},
    text:{fr:'Compare ton silver, ton gearscore et ta meilleure zone atteinte à celles des autres joueurs.', en:'Compare your silver, gearscore and best zone reached to other players.'} },
  { target:'#btnAchievements', placement:'bottom',
    title:{fr:'Les succès',en:'Achievements'},
    text:{fr:'Des objectifs à long terme avec des récompenses en silver à débloquer au fil de ta progression.', en:'Long-term goals with silver rewards to unlock as you progress.'} },
  { target:'#btnMailbox', placement:'bottom',
    title:{fr:'Le courrier',en:'The mailbox'},
    text:{fr:'200 Loyalties t\'y attendent chaque jour — elles s\'y empilent en permanence et ne se perdent jamais.', en:'200 Loyalties wait for you here every day — they stack up permanently and never get lost.'} },
  { target:'#btnPatch', placement:'bottom',
    title:{fr:'Les notes de version',en:'Patch notes'},
    text:{fr:'Retrouve ici tout ce qui change à chaque mise à jour du jeu.', en:'Find everything that changes with each game update here.'} },
  { target:'#btnMarket', placement:'bottom',
    title:{fr:'Le marché (BETA)',en:'The market (BETA)'},
    text:{fr:'Achète et vends du gear et des matériaux avec les autres joueurs. Cette fonctionnalité est encore en BETA, des ajustements sont à prévoir.', en:'Buy and sell gear and materials with other players. This feature is still in BETA, adjustments are to be expected.'} },
  { target:'#chatWidget', placement:'left',
    title:{fr:'Discute avec les autres joueurs',en:'Chat with other players'},
    text:{fr:'Mondial, Trade, Annonces... échange avec la communauté directement depuis le jeu.', en:'World, Trade, Announcements... chat with the community right from the game.'} },
  { target:'#btnLogout', placement:'bottom',
    title:{fr:'La déconnexion',en:'Logging out'},
    text:{fr:'Ta progression est sauvegardée automatiquement dans le cloud — tu peux te déconnecter puis te reconnecter sans rien perdre.', en:'Your progress is saved automatically in the cloud — you can log out and log back in without losing anything.'} },
  { target:'#uuidRow', placement:'bottom',
    title:{fr:'Ton UUID',en:'Your UUID'},
    text:{fr:'Cet identifiant unique te sera demandé si le staff doit t\'ajouter un rôle (modérateur, testeur...). Il n\'est pas affiché à l\'écran pour rester privé : clique sur ce bouton pour le copier directement.', en:'This unique ID will be asked from you if the staff needs to grant you a role (moderator, tester...). It isn\'t shown on screen to stay private: click this button to copy it directly.'} },
  { target:'#btnWiki', placement:'bottom', final:true,
    title:{fr:'Besoin d\'aide plus tard ?',en:'Need help later?'},
    text:{fr:'Tu peux relancer ce tutoriel à tout moment depuis le 📖 Wiki (onglet 🔰 Tutoriel), ou en cliquant sur 🏘️ Velia en haut de la liste des zones.', en:'You can replay this tutorial anytime from the 📖 Wiki (🔰 Tutorial tab), or by clicking 🏘️ Velia at the top of the zone list.'} },
];

let tutCompTabSaved = 'zones'; 
const COMPENDIUM_TUTORIAL_STEPS = [
  { title:{fr:'Le Compendium',en:'The Compendium'},
    text:{fr:'Une collection à vie : chaque zone <b>entièrement collectée</b> (ses 4 objets : trash, matériau, bijou, craft — pas juste visitée) et chaque World Boss vaincu (au moins une fois) t\'accorde un bonus PERMANENT et ADDITIF (jamais un multiplicateur).', en:'A lifetime collection: every zone <b>fully collected</b> (its 4 items: trash, material, jewelry, craft — not just visited) and every World Boss defeated (at least once) grants you a PERMANENT, ADDITIVE bonus (never a multiplier).'} },
  { target:'#infoBody .admStatTiles', placement:'bottom',
    title:{fr:'Ta progression globale',en:'Your overall progress'},
    text:{fr:'+1% Vitesse, +1% Dégâts et +1% Esquive pour chaque zone visitée ou boss vaincu — visible ici en un coup d\'œil.', en:'+1% Speed, +1% Damage and +1% Dodge for every zone visited or boss defeated — visible here at a glance.'} },
  { target:'#infoBody .catTabs', placement:'bottom',
    title:{fr:'3 onglets à explorer',en:'3 tabs to explore'},
    
    text:{fr:'Zones (farm), World Bosses et Maîtrise PEN (suivi pur, sans bonus) — chacun a sa propre logique, voir les étapes suivantes. Le sac protégé vit maintenant dans la carte Inventaire.', en:'Zones (farming), World Bosses and PEN Mastery (pure tracking, no bonus) — each has its own logic, see the next steps. The protected bag now lives in the Inventory card.'},
    before: () => { tutCompTabSaved = compendiumTab; compendiumTab = 'zones'; openCompendium(); } },
  { target:'#infoBody .compZoneRow', placement:'top',
    title:{fr:'Une zone, ses objets',en:'A zone, its items'},
    text:{fr:'✓ = objet déjà obtenu au moins une fois. Il faut les 4 ✓ de la zone (trash, matériau, bijou, craft) pour toucher son bonus. Clique sur un objet pour voir quelles zones le font dropper, puis clique une zone pour y lancer le farm directement (téléportation immédiate, sans confirmation).', en:'✓ = item already obtained at least once. You need all 4 ✓ for that zone (trash, material, jewelry, craft) to earn its bonus. Click an item to see which zones drop it, then click a zone to start farming there right away (instant teleport, no confirmation).'},
    before: () => { compendiumTab = 'zones'; openCompendium(); } },
  { target:'#infoBody .compPenGrid', placement:'top', final:true,
    title:{fr:'Maîtrise PEN',en:'PEN Mastery'},
    text:{fr:'Suivi de complétion pur (aucun bonus de stats) : amène chaque pièce d\'équipement et chaque bijou à PEN (niveau max) au moins une fois dans ton inventaire. Tu peux relancer ce tutoriel à tout moment avec le bouton "?" en haut du panneau.', en:'Pure completion tracker (no stat bonus): bring every gear piece and every jewel to PEN (max level) at least once in your inventory. You can replay this tutorial anytime with the "?" button at the top of the panel.'},
    before: () => { compendiumTab = 'pen'; openCompendium(); },
    after: () => { compendiumTab = tutCompTabSaved; openCompendium(); } },
];
function startCompendiumTutorial() {
  tutCompTabSaved = compendiumTab;
  startTutorial(COMPENDIUM_TUTORIAL_STEPS, { resetView:false });
}

const CRON_TUTORIAL_STEPS = [
  { target:'#optCronSlot', placement:'top', final:true,
    title:{fr:'Pierre de Cron',en:'Cron Stone'},
    text:{fr:'Cet objet protège ta pièce d\'équipement contre une rétrogradation en cas d\'échec d\'optimisation. Clique dessus pour l\'activer ou la désactiver.', en:'This item protects your gear piece from downgrading if an enhancement attempt fails. Click it to activate or deactivate it.'} },
];
function startCronTutorial() {
  startTutorial(CRON_TUTORIAL_STEPS, { resetView:false });
}
let tutorialStepIdx = -1;

let activeTutorialSteps = TUTORIAL_STEPS;

function updateTutorialScrollHint(r) {
  const hint = $a('tutorialScrollHint');
  if (!r) { hint.classList.remove('show'); return; }
  const below = r.top >= window.innerHeight;
  const above = r.bottom <= 0;
  if (!below && !above) { hint.classList.remove('show'); return; }
  hint.classList.add('show');
  hint.classList.toggle('up', above);
  hint.style.top = above ? '18px' : (window.innerHeight-56)+'px';
}
function positionTutorialStep() {
  const step = activeTutorialSteps[tutorialStepIdx];
  const hi = $a('tutorialHighlight'), box = $a('tutorialBox'), arrow = $a('tutorialArrow');
  const target = step.target ? document.querySelector(step.target) : null;
  if (!target) {
    
    hi.classList.add('center'); hi.style.top='0'; hi.style.left='0'; hi.style.width='0'; hi.style.height='0';
    arrow.style.display = 'none';
    box.style.top = '50%'; box.style.left = '50%'; box.style.transform = 'translate(-50%,-50%)';
    updateTutorialScrollHint(null);
  } else {
    const r = target.getBoundingClientRect();
    updateTutorialScrollHint(r);
    const pad = 6;
    hi.classList.remove('center');
    hi.style.top = (r.top-pad)+'px'; hi.style.left = (r.left-pad)+'px';
    hi.style.width = (r.width+pad*2)+'px'; hi.style.height = (r.height+pad*2)+'px';
    box.style.transform = 'none';
    const boxW = 280, gap = 16, arrowSize = 11;
    let bx, by, arrowCls;
    if (step.placement === 'bottom') { bx = r.left+r.width/2-boxW/2; by = r.bottom+pad+gap; arrowCls='top'; }
    
    else if (step.placement === 'top') { bx = r.left+r.width/2-boxW/2; by = r.top-pad-gap-box.offsetHeight; arrowCls='bottom'; }
    else if (step.placement === 'right') { bx = r.right+pad+gap; by = r.top+r.height/2-70; arrowCls='left'; }
    else { bx = r.left-pad-gap-boxW; by = r.top+r.height/2-70; arrowCls='right'; } 
    bx = Math.max(10, Math.min(window.innerWidth-boxW-10, bx));
    by = Math.max(10, Math.min(window.innerHeight-160, by));
    box.style.left = bx+'px'; box.style.top = by+'px';
    arrow.style.display = '';
    arrow.className = arrowCls;
    if (arrowCls==='top' || arrowCls==='bottom') {
      arrow.style.left = (r.left+r.width/2-9)+'px';
      arrow.style.top = arrowCls==='top' ? (r.bottom+pad+2)+'px' : (r.top-pad-13)+'px';
    } else {
      arrow.style.top = (r.top+r.height/2-9)+'px';
      arrow.style.left = arrowCls==='left' ? (r.right+pad+2)+'px' : (r.left-pad-13)+'px';
    }
  }
}
function showTutorialStep() {
  const step = activeTutorialSteps[tutorialStepIdx];
  $a('tutStepLbl').textContent = `${LANG==='fr'?'Étape':'Step'} ${tutorialStepIdx+1} / ${activeTutorialSteps.length}`;
  $a('tutTitle').textContent = step.title[LANG];
  $a('tutText').textContent = step.text[LANG];
  $a('tutSkipBtn').textContent = LANG==='fr'?'Passer':'Skip';
  $a('tutPrevBtn').textContent = LANG==='fr'?'← Précédent':'← Back';
  $a('tutPrevBtn').disabled = tutorialStepIdx <= 0;
  $a('tutNextBtn').textContent = step.final ? (LANG==='fr'?'Terminer':'Finish') : (LANG==='fr'?'Suivant →':'Next →');
  
  if (step.before) step.before();
  positionTutorialStep();
}

function leaveTutorialStep() {
  const step = activeTutorialSteps[tutorialStepIdx];
  if (step && step.after) step.after();
}

let tutorialRafId = 0;
function tutorialTrackLoop() {
  if (tutorialStepIdx < 0) { tutorialRafId = 0; return; }
  positionTutorialStep();
  tutorialRafId = requestAnimationFrame(tutorialTrackLoop);
}

function startTutorial(steps = TUTORIAL_STEPS, { resetView = true } = {}) {
  activeTutorialSteps = steps;
  if (resetView) { questsPanelOpen = false; $a('infoOverlay').classList.remove('open'); currentActivity = 'zone'; showActivityPage('zone'); }
  tutorialStepIdx = 0;
  $a('tutorialOverlay').classList.add('open');
  showTutorialStep();
  if (!tutorialRafId) tutorialRafId = requestAnimationFrame(tutorialTrackLoop);
}
function endTutorial() {
  leaveTutorialStep();
  tutorialStepIdx = -1;
  $a('tutorialOverlay').classList.remove('open');
}
$a('tutNextBtn').onclick = () => {
  const step = activeTutorialSteps[tutorialStepIdx];
  leaveTutorialStep();
  if (step.final) { endTutorial(); return; }
  tutorialStepIdx++; showTutorialStep();
};
$a('tutSkipBtn').onclick = endTutorial;
$a('tutPrevBtn').onclick = () => {
  if (tutorialStepIdx <= 0) return;
  leaveTutorialStep();
  tutorialStepIdx--; showTutorialStep();
};

let patchPageStart = 0;
try { patchPageStart = parseInt(localStorage.getItem('velia-patch-page')||'0', 10) || 0; } catch(e) {}
function commitPatchRead() { 
  try {
    const merged = new Set([...readPatches, ...seenThisSession]);
    localStorage.setItem('velia-patch-read', JSON.stringify([...merged]));
  } catch(e) {}
}
window.addEventListener('beforeunload', commitPatchRead);
window.addEventListener('pagehide', commitPatchRead); 

function unreadPatchCount() { return PATCH_NOTES.filter(p => !readPatches.has(p.v) && !seenThisSession.has(p.v)).length; }

const PATCH_PAGE_MIN = 2, PATCH_PAGE_MAX = 7, PATCH_PAGE_LINE_BUDGET = 10;
function computePatchPages() {
  const pages = [];
  let i = 0;
  while (i < PATCH_NOTES.length) {
    let count = 0, lines = 0;
    while (count < PATCH_PAGE_MAX && i+count < PATCH_NOTES.length) {
      const entryLines = (PATCH_NOTES[i+count][LANG] || []).length;
      if (count >= PATCH_PAGE_MIN && lines + entryLines > PATCH_PAGE_LINE_BUDGET) break;
      lines += entryLines; count++;
    }
    if (count === 0) count = 1; 
    pages.push({ start: i, count });
    i += count;
  }
  return pages;
}
function updatePatchBadge() {
  const n = unreadPatchCount();
  const badge = $a('patchBadge');
  if (badge) { badge.textContent = n; badge.classList.toggle('show', n > 0); }
  $a('btnPatch').classList.toggle('hasNew', n > 0);
  
  const banner = $a('patchUnreadBanner');
  if (banner) {
    const patchPanelOpen = $a('infoOverlay').classList.contains('open') && document.querySelector('.patchEntry');
    $a('patchUnreadBannerNum').textContent = n;
    banner.classList.toggle('show', n > 0 && !!patchPanelOpen);
  }
}

const PATCH_CATS = {
  new:     { fr:'Nouveautés',           en:'New',            icon:'🆕', color:'#8fc98a',
    desc:{fr:'Nouveau contenu ajouté au jeu', en:'New content added to the game'} },
  change:  { fr:'Équilibrage',          en:'Balancing',      icon:'⚖️', color:'#9cc9e8',
    desc:{fr:'Ajustement de valeurs existantes (stats, taux, difficulté...)', en:'Adjustment of existing values (stats, rates, difficulty...)'} },
  improve: { fr:'Améliorations',        en:'Improvements',   icon:'✨', color:'#7ec9c2',
    desc:{fr:'Amélioration de l\'existant sans changer son fonctionnement de base', en:'Improvement of something existing without changing its core behavior'} },
  fix:     { fr:'Corrections de bugs',  en:'Bug fixes',      icon:'🐛', color:'#e8b84a',
    desc:{fr:'Correction d\'un bug ou d\'un comportement incorrect', en:'Fix for a bug or incorrect behavior'} },
  exploit: { fr:'Sécurité',             en:'Security',       icon:'🔒', color:'#b48ce8',
    desc:{fr:'Faille de sécurité corrigée', en:'Security vulnerability fixed'} },
  admin:   { fr:'Serveur',              en:'Server',         icon:'🌐', color:'#c9a55a',
    desc:{fr:'Changement côté serveur/infrastructure', en:'Server-side/infrastructure change'} },
  event:   { fr:'Événements',           en:'Events',         icon:'🎉', color:'#e89fc4',
    desc:{fr:'Contenu ou bonus temporaire', en:'Temporary content or bonus'} },
  info:    { fr:'Informations',         en:'Information',    icon:'📢', color:'#9aa8c9',
    desc:{fr:'Annonce ou information, sans changement de jeu', en:'Announcement or information, no gameplay change'} },
};

const PATCH_PLATFORMS = {
  mobile: { fr:'Tab/Mobile', en:'Tab/Mobile', icon:'📱', color:'#e0a840',
    desc:{fr:'Concerne uniquement tablette/téléphone', en:'Only concerns tablet/phone'} },
  firefox: { fr:'Firefox', en:'Firefox', icon:'🦊', color:'#e0824a',
    desc:{fr:'Bug spécifique à Firefox (Chrome non affecté)', en:'Firefox-specific bug (Chrome unaffected)'} },
};

const PATCH_NATURE = {
  opticode:     { fr:'Optim. code',   en:'Code opti',   icon:'🧹', color:'#7aa8c9',
    desc:{fr:'Nettoyage/restructuration du code, sans impact visible', en:'Code cleanup/restructuring, no visible impact'} },
  optimisation: { fr:'Optimisation',  en:'Optimization', icon:'⚡', color:'#c9a55a',
    desc:{fr:'Optimisation de performance ou d\'algorithme', en:'Performance or algorithm optimization'} },
  inventaire:   { fr:'Inventaire',    en:'Inventory',   icon:'🎒', color:'#8fc98a',
    desc:{fr:'Concerne le stockage/la structure des données de sauvegarde', en:'Concerns storage/structure of save data'} },
  backend:      { fr:'Backend',       en:'Backend',     icon:'🗄️', color:'#b48ce8',
    desc:{fr:'Changement côté serveur (Supabase, base de données...)', en:'Server-side change (Supabase, database...)'} },
};

const PATCH_SEVERITY = {
  critical: { fr:'Critique', en:'Critical', color:'#e85a5a',
    desc:{fr:'Impact majeur : sécurité, perte de données, ou jeu bloqué', en:'Major impact: security, data loss, or game-blocking issue'} },
  major:    { fr:'Important', en:'Major', color:'#e8a840',
    desc:{fr:'Changement notable qui affecte l\'expérience de jeu', en:'Notable change affecting the gameplay experience'} },
  minor:    { fr:'Mineur', en:'Minor', color:'#e8d840',
    desc:{fr:'Petit ajustement, impact limité', en:'Small adjustment, limited impact'} },
  info:     { fr:'Info', en:'Info', color:'#9aa8c9',
    desc:{fr:'Purement informatif, aucun impact sur le jeu', en:'Purely informational, no impact on the game'} },
};

const PATCH_SUBCATS = {
  boss:'Boss', monstres:'Monstres', zones:'Zones', quetes:'Quêtes', pnj:'PNJ', objets:'Objets',
  equipements:'Équipements', competences:'Compétences', systeme:'Système de jeu',
  pve:'PvE', loot:'Loot', economie:'Économie', craft:'Craft', xp:'Expérience (XP)',
  interface:'Interface (UI)', ux:'Expérience utilisateur (UX)', perf:'Performances',
  optimisation:'Optimisation', graphismes:'Graphismes', audio:'Audio', animations:'Animations',
  accessibilite:'Accessibilité', chargement:'Temps de chargement',
  gameplay:'Gameplay', combat:'Combat', inventaire:'Inventaire', reseau:'Réseau',
  sauvegarde:'Sauvegarde', connexion:'Connexion',
  anticheat:'Anti-triche', authentification:'Authentification', comptes:'Comptes',
  serveur:'Serveur', securite:'Correctifs de sécurité',
  maintenance:'Maintenance', infrastructure:'Infrastructure', bdd:'Base de données',
  synchro:'Synchronisation',
  eventTemp:'Événements temporaires', bonusXp:'Bonus XP', bonusDrop:'Bonus Drop',
  cadeaux:'Cadeaux', calendrier:'Calendrier',
  annonces:'Annonces', roadmap:'Feuille de route', prochaines:'Prochaines mises à jour',
  connus:'Problèmes connus', tresors:'Trésors',
};
const PATCH_SUBCATS_EN = {
  boss:'Boss', monstres:'Monsters', zones:'Zones', quetes:'Quests', pnj:'NPC', objets:'Items',
  equipements:'Gear', competences:'Skills', systeme:'Game systems',
  pve:'PvE', loot:'Loot', economie:'Economy', craft:'Crafting', xp:'Experience (XP)',
  interface:'Interface (UI)', ux:'User experience (UX)', perf:'Performance',
  optimisation:'Optimization', graphismes:'Graphics', audio:'Audio', animations:'Animations',
  accessibilite:'Accessibility', chargement:'Loading times',
  gameplay:'Gameplay', combat:'Combat', inventaire:'Inventory', reseau:'Network',
  sauvegarde:'Save', connexion:'Login',
  anticheat:'Anti-cheat', authentification:'Authentication', comptes:'Accounts',
  serveur:'Server', securite:'Security fixes',
  maintenance:'Maintenance', infrastructure:'Infrastructure', bdd:'Database',
  synchro:'Synchronization',
  eventTemp:'Time-limited events', bonusXp:'XP bonus', bonusDrop:'Drop bonus',
  cadeaux:'Gifts', calendrier:'Calendar',
  annonces:'Announcements', roadmap:'Roadmap', prochaines:'Upcoming updates',
  connus:'Known issues', tresors:'Treasures',
};

function renderPatchEntryHtml(p, absIdx) {
    const isNew = !readPatches.has(p.v); 
    return `
    <div class="patchEntry ${absIdx===0?'latest':''}" data-ver="${p.v}">
      <div class="patchEntryHead">
        <span class="patchVer">${p.v}</span>
        ${p.name ? `<span class="patchName">${p.name[LANG]}</span>` : ''}
        ${isNew ? '<span class="patchNewTag">NEW</span>' : ''}
        ${p.d ? `<span class="patchDate">${p.d}</span>` : ''}
      </div>
      ${(() => {
        
        const groups = [];
        for (const line of p[LANG]) {
          const key = line.t || 'change';
          let g = groups.find(g => g.key === key);
          if (!g) { g = { key, lines: [] }; groups.push(g); }
          g.lines.push(line);
        }
        return groups.map(g => {
          const cat = PATCH_CATS[g.key] || PATCH_CATS.change;
          const subMap = LANG === 'fr' ? PATCH_SUBCATS : PATCH_SUBCATS_EN;
          return `
          <div class="patchGroup">
            <div class="patchGroupHead" style="color:${cat.color}" title="${escapeHtml(cat.desc[LANG])}">${cat.icon} ${cat[LANG]}</div>
            <ul>${g.lines.map(line => {
              const sev = line.severity ? PATCH_SEVERITY[line.severity] : null;
              const plat = line.plat ? PATCH_PLATFORMS[line.plat] : null;
              const nature = line.nature ? PATCH_NATURE[line.nature] : null;
              const sub = line.sub ? subMap[line.sub] : null;
              
              const sevTag = sev ? `<span class="patchCat" style="color:${sev.color};border-color:${sev.color}" title="${escapeHtml(sev.desc[LANG])}"><span class="patchSevDot" style="background:${sev.color}"></span>${sev[LANG]}</span>` : '';
              const platTag = plat ? `<span class="patchCat" style="color:${plat.color};border-color:${plat.color}" title="${escapeHtml(plat.desc[LANG])}">${plat.icon} ${plat[LANG]}</span>` : '';
              const natureTag = nature ? `<span class="patchCat" style="color:${nature.color};border-color:${nature.color}" title="${escapeHtml(nature.desc[LANG])}">${nature.icon} ${nature[LANG]}</span>` : '';
              
              const subTag = sub ? `<span class="patchSub" style="color:${cat.color};border-color:${cat.color}55" title="${LANG==='fr'?'Sous-catégorie':'Subcategory'} : ${escapeHtml(sub)}">${sub}</span>` : '';
              const extraTags = sevTag + subTag + platTag + natureTag;
              const removedTag = line.removed ? `<span class="patchRemoved">${LANG==='fr'?'🗑 Supprimé':'🗑 Removed'}</span>` : '';
              
              const imgBtn = line.img ? `<button class="patchImgBtn" data-before="${escapeHtml(line.img.before)}" data-after="${escapeHtml(line.img.after)}" title="${LANG==='fr'?'Voir avant/après':'See before/after'}">🖼️</button>` : '';
              return `<li class="${line.removed?'patchLineRemoved':''}">
                <div class="patchLineMain"><span class="patchLineText">${line.tx}${removedTag}</span>${imgBtn}</div>
                ${extraTags ? `<div class="patchLineExtra">${extraTags}</div>` : ''}
              </li>`;
            }).join('')}</ul>
          </div>`;
        }).join('');
      })()}
    </div>`;
}

function renderPatchNotesPanel() {
  const pages = computePatchPages();
  let pageIdx = pages.findIndex(pg => pg.start === patchPageStart);
  if (pageIdx === -1) { pageIdx = 0; patchPageStart = pages[0].start; } 
  const page = pages[pageIdx];
  const entries = PATCH_NOTES.slice(page.start, page.start + page.count);

  const unreadNow = unreadPatchCount();
  const unreadBannerHtml = `<div id="patchUnreadBanner" class="${unreadNow>0?'show':''}">` +
    `<span id="patchUnreadBannerNum">${unreadNow}</span> ` +
    `<span>${LANG==='fr'?'note(s) de version non lue(s) — clique pour remonter':'unread patch note(s) — click to jump to newest'}</span></div>`;

  const navHtml = `<div class="patchNavRow">
      <button id="patchNavUp" class="patchNavBtn"${pageIdx===0?' disabled':''} title="${LANG==='fr'?'Notes plus récentes':'Newer notes'}">▲ ${LANG==='fr'?'Plus récent':'Newer'}</button>
      <span class="patchNavPos">${page.start+1}–${page.start+entries.length} / ${PATCH_NOTES.length}</span>
      <button id="patchNavDown" class="patchNavBtn"${pageIdx===pages.length-1?' disabled':''} title="${LANG==='fr'?'Notes plus anciennes':'Older notes'}">${LANG==='fr'?'Plus ancien':'Older'} ▼</button>
    </div>`;

  const entriesHtml = entries.map((p,k) => renderPatchEntryHtml(p, page.start+k)).join('');
  openInfo(LANG === 'fr' ? '📜 Notes de version' : '📜 Patch Notes', unreadBannerHtml + navHtml + entriesHtml);

  let changed = false;
  entries.forEach(p => { if (!seenThisSession.has(p.v)) { seenThisSession.add(p.v); changed = true; } });
  if (changed) updatePatchBadge();

  try { localStorage.setItem('velia-patch-page', String(patchPageStart)); } catch(e) {}

  const unreadBannerEl = $a('patchUnreadBanner');
  if (unreadBannerEl) unreadBannerEl.onclick = () => { patchPageStart = 0; renderPatchNotesPanel(); };
  const upBtn = $a('patchNavUp'), downBtn = $a('patchNavDown');
  if (upBtn) upBtn.onclick = () => { if (pageIdx > 0) { patchPageStart = pages[pageIdx-1].start; renderPatchNotesPanel(); } };
  if (downBtn) downBtn.onclick = () => { if (pageIdx < pages.length-1) { patchPageStart = pages[pageIdx+1].start; renderPatchNotesPanel(); } };

  $a('infoBody').querySelectorAll('.patchImgBtn').forEach(btn => {
    btn.onclick = () => openPatchImgCompare(btn.dataset.before, btn.dataset.after);
  });
}
$a('btnPatch').onclick = renderPatchNotesPanel;
function openPatchImgCompare(before, after) {
  $a('patchImgLblBefore').textContent = LANG==='fr' ? 'Avant' : 'Before';
  $a('patchImgLblAfter').textContent = LANG==='fr' ? 'Après' : 'After';
  $a('patchImgBefore').src = before;
  $a('patchImgAfter').src = after;
  $a('patchImgOverlay').classList.add('open');
}
$a('closePatchImg').onclick = () => $a('patchImgOverlay').classList.remove('open');
let patchImgMouseDownOnBackdrop = false;
$a('patchImgOverlay').addEventListener('mousedown', e => { patchImgMouseDownOnBackdrop = (e.target.id === 'patchImgOverlay'); });
$a('patchImgOverlay').addEventListener('click', e => { if (e.target.id === 'patchImgOverlay' && patchImgMouseDownOnBackdrop) $a('patchImgOverlay').classList.remove('open'); });

updatePatchBadge();
applyI18n();

// ==== src/admin/admin-panel.js ====
async function resetDemo() {
  if (!isAdmin()) return; 
  const msg = LANG === 'fr'
    ? "Réinitialiser la démo ? Toute ta progression (silver, équipement, niveau, sac) sera perdue et remise à zéro. Cette action est irréversible."
    : "Reset the demo? All your progress (silver, gear, level, bag) will be lost and set back to zero. This action is irreversible.";
  if (!confirm(msg)) return;
  applySaveState(JSON.parse(JSON.stringify(DEFAULT_SAVE)));
  suppressLoyaltyGrantForToday();
  if (sb && currentUser) await saveToCloud(); 
  try { localStorage.setItem('velia-idle-save', JSON.stringify(getSaveState())); } catch(e) {}
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Démo réinitialisée' : 'Demo reset', { gold:true });
}

function resetMyQuests() {
  if (!isAdmin()) return;
  S.dq = null; S.wq = null;
  ensureQuests('daily'); ensureQuests('weekly');
  hud();
  if ($a('infoOverlay').classList.contains('open')) openDailyQuests();
  if (sb && currentUser) saveToCloud();
  try { localStorage.setItem('velia-idle-save', JSON.stringify(getSaveState())); } catch(e) {}
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Quêtes réinitialisées' : 'Quests reset', { gold:true });
}

async function resetAllQuests() {
  if (!isAdmin() || !sb) return;
  const msg = LANG === 'fr'
    ? "Réinitialiser les quêtes de TOUS les joueurs ? Chacun se verra retirer sa progression de quêtes en cours (journalières et hebdomadaires) et de nouvelles seront tirées à leur prochaine connexion. Action irréversible."
    : "Reset quests for ALL players? Everyone's in-progress quests (daily and weekly) will be cleared and new ones drawn on their next login. This action is irreversible.";
  if (!confirm(msg)) return;
  const { error } = await sb.rpc('admin_reset_all_quests');
  if (!error) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé les quêtes de tous les joueurs`, 0x9cc9e8);
  if (error) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true });
    return;
  }
  resetMyQuests(); 
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Quêtes de tous les joueurs réinitialisées ✓' : "All players' quests reset ✓", { gold:true });
}

async function resetAllAccounts() {
  if (!isAdmin() || !sb) return;
  const msg1 = LANG === 'fr'
    ? '💥 Réinitialiser TOUS les comptes de TOUS les joueurs (silver, équipement, niveau, sac) ? Un message d\'explication leur sera montré à leur prochaine connexion. Action IRRÉVERSIBLE.'
    : '💥 Reset ALL accounts of ALL players (silver, gear, level, bag)? An explanation message will be shown to them on their next login. This action is IRREVERSIBLE.';
  if (!confirm(msg1)) return;
  const msg2 = LANG === 'fr'
    ? 'Es-tu VRAIMENT sûr ? Il n\'y a aucun moyen de récupérer la progression perdue.'
    : 'Are you REALLY sure? There is no way to recover the lost progress.';
  if (!confirm(msg2)) return;
  const title_fr = '🔄 Remise à zéro de tous les comptes';
  const title_en = '🔄 All accounts have been reset';
  const body_fr = 'Merci beaucoup pour votre aide pendant la phase de test précédente ! 🙏<br><br>' +
    'Suite à un <b>gros changement d\'économie, de stuff et d\'équilibrage</b>, nous avons dû remettre TOUS les comptes à zéro pour repartir sur des tests propres et mieux calibrer le jeu.<br><br>' +
    'Pour info : le jeu est en <b>développement constant</b>, d\'autres resets peuvent survenir à tout moment tant qu\'on est en phase de test.';
  const body_en = 'Thank you so much for your help during the previous testing phase! 🙏<br><br>' +
    'Following a <b>major economy, gear and balance overhaul</b>, we had to reset ALL accounts to zero to start fresh testing and better calibrate the game.<br><br>' +
    'Note: the game is in <b>constant development</b>, more resets may happen at any time while we\'re in testing.';
  const { data, error } = await sb.rpc('admin_reset_all_accounts', { p_title_fr: title_fr, p_title_en: title_en, p_body_fr: body_fr, p_body_en: body_en });
  if (error) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true });
    return;
  }
  logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé TOUS les comptes (${data} comptes)`, 0xc05545);
  floatTxt(P.x, P.y, 100, LANG==='fr' ? `${data} comptes réinitialisés ✓` : `${data} accounts reset ✓`, { gold:true });
  
  applySaveState(JSON.parse(JSON.stringify(DEFAULT_SAVE)));
  suppressLoyaltyGrantForToday();
  await saveToCloud();
  showResetNotice('🔄', title_fr, body_fr);
}

async function adminScreenshotPlayer() {
  if (!isAdmin() || !sb) return;
  const uuid = ($a('admResetUuidInput').value || '').trim();
  if (!uuid) return;
  const { data, error } = await sb.rpc('admin_get_player_save', { p_user_id: uuid });
  if (error) { floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true }); return; }
  if (!data) { floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Aucune sauvegarde pour cet UUID' : 'No save found for that UUID', { hurt:true }); return; }
  openInfo((LANG==='fr'?'📸 Screenshot — ':'📸 Screenshot — ') + escapeHtml(data._pseudo||'?'), renderAdminScreenshotHtml(data));
}
function renderAdminScreenshotHtml(save) {
  const s = save.S || {};
  const eq = save.EQUIP || {};
  const inv = (save.INV || []).filter(Boolean);
  const zone = ZONES[save.zoneIdx];
  const zoneName = zone ? tr(zone.name) : (LANG==='fr'?'Velia':'Velia');
  const eqRows = Object.entries(eq).filter(([,v]) => v).map(([slot,it]) => {
    const lvl = it.optimizable ? (ENH_NAMES[it.enhLv||0] || '+0') : '';
    return `<div class="row"><span>${it.icon||'▪'} ${SLOT_LABEL[slot]||slot}</span><span class="v">${escapeHtml(it.name)}${lvl?' ('+lvl+')':''}</span></div>`;
  }).join('') || `<div class="admEmpty">${LANG==='fr'?'Aucun équipement':'No gear'}</div>`;
  const invRows = inv.map(it =>
    `<div class="row"><span>${it.icon||'▪'} ${escapeHtml(it.name)}</span><span class="v">${it.stackable ? 'x'+it.qty : (it.optimizable ? (ENH_NAMES[it.enhLv||0]||'+0') : '')}</span></div>`
  ).join('') || `<div class="admEmpty">${LANG==='fr'?'Sac vide':'Empty bag'}</div>`;
  return `
    <div class="admStatTiles">
      <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'Niveau':'Level'}</div><div class="astVal">${s.lvl||1}</div></div>
      <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'Silver':'Silver'}</div><div class="astVal">${fmt(Math.round(s.silver||0))}</div></div>
      <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'Zone':'Zone'}</div><div class="astVal">${escapeHtml(zoneName)}</div></div>
    </div>
    <div class="admSummary">${LANG==='fr'?'Sauvegardé le':'Saved on'} ${save.savedAt ? new Date(save.savedAt).toLocaleString(LANG==='fr'?'fr-FR':'en-US') : '—'}</div>
    <h3>${LANG==='fr'?'Équipement':'Equipment'}</h3>${eqRows}
    <h3>${LANG==='fr'?'Inventaire':'Inventory'} (${inv.length}/${INV_SIZE})</h3>${invRows}
  `;
}

async function resetAccountByUuid() {
  if (!isAdmin() || !sb) return;
  const input = $a('admResetUuidInput');
  const uuid = (input.value || '').trim();
  if (!uuid) return;
  
  let online = false;
  try {
    const { data } = await sb.rpc('admin_is_player_online', { p_user_id: uuid, p_window_seconds: 90 });
    online = !!data;
  } catch(e) {}
  const onlineWarn = online
    ? (LANG === 'fr'
        ? '\n\n⚠️ CE JOUEUR EST ACTUELLEMENT EN LIGNE : sa propre sauvegarde automatique (toutes les 30s environ) risque de RÉÉCRIRE son ancien état par-dessus ce reset dans les secondes qui suivent, l\'annulant silencieusement. Pour un reset fiable, attends qu\'il soit déconnecté.'
        : '\n\n⚠️ THIS PLAYER IS CURRENTLY ONLINE: their own autosave (roughly every 30s) may OVERWRITE their old state back over this reset within seconds, silently undoing it. For a reliable reset, wait until they\'re disconnected.')
    : '';
  const msg = (LANG === 'fr'
    ? `🔄 Réinitialiser le compte du joueur ${uuid} (silver, équipement, niveau, sac) ? Un message d'explication lui sera montré à sa prochaine connexion. Action IRRÉVERSIBLE.`
    : `🔄 Reset player ${uuid}'s account (silver, gear, level, bag)? An explanation message will be shown to them on their next login. This action is IRREVERSIBLE.`) + onlineWarn;
  if (!confirm(msg)) return;
  const title_fr = '🔄 Ton compte a été réinitialisé';
  const title_en = '🔄 Your account has been reset';
  const body_fr = 'Un membre du staff a réinitialisé ton compte (silver, équipement, niveau, sac).<br><br>' +
    'Si tu penses qu\'il s\'agit d\'une erreur, contacte-nous sur Discord.';
  const body_en = 'A staff member has reset your account (silver, gear, level, bag).<br><br>' +
    'If you believe this is a mistake, please reach out to us on Discord.';
  const { data, error } = await sb.rpc('admin_reset_account_by_uuid', {
    p_user_id: uuid, p_title_fr: title_fr, p_title_en: title_en, p_body_fr: body_fr, p_body_en: body_en
  });
  if (error) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Échec — ' + error.message : 'Failed — ' + error.message, { hurt:true });
    return;
  }
  if (!data) {
    floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Aucun joueur trouvé avec cet UUID' : 'No player found with that UUID', { hurt:true });
    return;
  }
  logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a réinitialisé le compte du joueur \`${uuid}\``, 0xc05545);
  floatTxt(P.x, P.y, 100, LANG==='fr' ? 'Compte réinitialisé ✓' : 'Account reset ✓', { gold:true });
  input.value = '';
}

function fmtAdmPlaytime(sec) {
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60);
  return `${h}h${String(m).padStart(2,'0')}`;
}

function buildAdminAnalyticsHtml(byHour, byItem, wealth, playtimeByUser, playtimeByHour, nameByUser, silverByCategory, silverByHour, playerStats) {
  const hourMap = new Map();
  (byHour||[]).forEach(r => hourMap.set(r.hour, (hourMap.get(r.hour)||0) + Number(r.total_silver||0)));
  const hours = [...hourMap.entries()].sort((a,b) => new Date(b[0]) - new Date(a[0])).slice(0,24);
  const maxSilver = Math.max(1, ...hours.map(h => h[1]));
  const hourHtml = hours.map(([h,v]) => {
    const label = new Date(h).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { hour:'2-digit', day:'2-digit', month:'2-digit' });
    const pct = Math.round(v/maxSilver*100);
    return `<div class="admBarRow"><span class="admBarLbl">${label}</span><div class="admBarTrack"><div class="admBar" style="width:${pct}%"></div></div><span class="admBarVal">${fmt(v)}</span></div>`;
  }).join('') || `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;

  const ptRows = (playtimeByHour||[]).map(r => ({ hour:r.hour, players:Number(r.players||0), sec:Number(r.playtime_sec||0) }))
    .sort((a,b) => new Date(b.hour) - new Date(a.hour)).slice(0,24);
  const maxPlayers = Math.max(1, ...ptRows.map(r => r.players));
  const ptHourHtml = ptRows.map(r => {
    const label = new Date(r.hour).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { hour:'2-digit', day:'2-digit', month:'2-digit' });
    const pct = Math.round(r.players/maxPlayers*100);
    return `<div class="admBarRow"><span class="admBarLbl">${label}</span><div class="admBarTrack"><div class="admBar" style="width:${pct}%"></div></div><span class="admBarVal">${r.players} · ${fmtAdmPlaytime(r.sec)}</span></div>`;
  }).join('') || `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;

  const itemHtml = (byItem||[]).map((r,i) => `
    <tr class="${i===0?'admTop':''}">
      <td>${i===0?'🔥 ':''}${tr(r.item_name)}</td><td>${r.item_kind}</td>
      <td>${fmt(r.pickups)}</td><td>${fmt(r.total_qty)}</td><td>${fmt(r.total_silver)}</td>
    </tr>`).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;

  const silvers = (wealth||[]).map(r => Number(r.silver||0)).sort((a,b) => a-b);
  const totalSilver = silvers.reduce((a,b) => a+b, 0);
  const avgSilver = silvers.length ? Math.round(totalSilver/silvers.length) : 0;
  const medSilver = silvers.length ? silvers[Math.floor(silvers.length/2)] : 0;
  
  const totalEarned = (wealth||[]).reduce((a,r) => a + Number(r.silver_earned||0), 0);
  const totalSpent = Math.max(0, totalEarned - totalSilver);
  const spentPct = totalEarned > 0 ? Math.round(totalSpent/totalEarned*100) : 0;
  
  const CATEGORY_LABEL = {
    loot:{fr:'🎒 Butin au sol (trash)',en:'🎒 Ground loot (trash)'},
    sell:{fr:'🏷️ Ventes (sac)',en:'🏷️ Sales (bag)'},
    potion:{fr:'🧪 Potions',en:'🧪 Potions'},
    quest:{fr:'🗒️ Quêtes',en:'🗒️ Quests'},
    achievement:{fr:'🏅 Succès',en:'🏅 Achievements'},
    boss:{fr:'🐋 World Boss',en:'🐋 World Boss'},
    welcome:{fr:'🎁 Bonus de bienvenue',en:'🎁 Welcome bonus'},
    market_buy:{fr:'🏛️ Marché — achats',en:'🏛️ Market — buys'},
    market_sell:{fr:'🏛️ Marché — ventes',en:'🏛️ Market — sells'},
    market_refund:{fr:'🏛️ Marché — remboursements',en:'🏛️ Market — refunds'},
    undo_sell:{fr:'↩️ Annulation de vente',en:'↩️ Sale undo'},
    admin_test:{fr:'🛠️ Test admin',en:'🛠️ Admin test'},
  };
  const catRows = (silverByCategory||[]).map(r => ({
    category: r.category, gained: Number(r.total_gained||0), spent: Number(r.total_spent||0), tx: Number(r.tx_count||0),
  }));
  const maxCatVolume = Math.max(1, ...catRows.map(r => r.gained + r.spent));
  const categoryHtml = catRows.map(r => {
    const label = CATEGORY_LABEL[r.category] ? CATEGORY_LABEL[r.category][LANG] : r.category;
    const pct = Math.round((r.gained + r.spent) / maxCatVolume * 100);
    return `<tr><td>${escapeHtml(label)}</td><td class="admGain">+${fmt(r.gained)}</td><td class="admLoss">-${fmt(r.spent)}</td>` +
      `<td>${fmt(r.tx)}</td><td><div class="admBarTrack"><div class="admBar" style="width:${pct}%"></div></div></td></tr>`;
  }).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données (le registre vient d\'être mis en place)':'No data yet (the ledger was just set up)'}</td></tr>`;
  const silverHourRows = (silverByHour||[]).map(r => ({ hour:r.hour, net:Number(r.net_delta||0) }))
    .sort((a,b) => new Date(b.hour) - new Date(a.hour)).slice(0,24);
  const maxSilverHourAbs = Math.max(1, ...silverHourRows.map(r => Math.abs(r.net)));
  const silverHourHtml = silverHourRows.map(r => {
    const label = new Date(r.hour).toLocaleString(LANG==='fr'?'fr-FR':'en-US', { hour:'2-digit', day:'2-digit', month:'2-digit' });
    const pct = Math.round(Math.abs(r.net)/maxSilverHourAbs*100);
    return `<div class="admBarRow"><span class="admBarLbl">${label}</span><div class="admBarTrack"><div class="admBar${r.net<0?' admBarNeg':''}" style="width:${pct}%"></div></div><span class="admBarVal${r.net<0?' admLoss':' admGain'}">${r.net>=0?'+':''}${fmt(r.net)}</span></div>`;
  }).join('') || `<div class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</div>`;
  const WEALTH_BRACKETS = [
    { max:10000,      label:'< 10k' },
    { max:100000,     label:'10k-100k' },
    { max:1000000,    label:'100k-1M' },
    { max:10000000,   label:'1M-10M' },
    { max:Infinity,   label:'10M+' },
  ];
  const bracketCounts = WEALTH_BRACKETS.map(b => 0);
  for (const v of silvers) {
    const idx = WEALTH_BRACKETS.findIndex(b => v < b.max);
    bracketCounts[idx >= 0 ? idx : WEALTH_BRACKETS.length-1]++;
  }
  const maxBracketCount = Math.max(1, ...bracketCounts);
  const histHtml = WEALTH_BRACKETS.map((b,i) => {
    const pct = Math.max(2, Math.round(bracketCounts[i]/maxBracketCount*100));
    return `<div class="admHistBar"><span class="ahbCount">${bracketCounts[i]}</span><div class="ahbFill" style="height:${pct}%"></div><span class="ahbLbl">${b.label}</span></div>`;
  }).join('');
  const wealthHtml = (wealth||[]).slice(0,20).map((r,i) => `
    <tr><td>#${i+1}</td><td>${escapeHtml((nameByUser&&nameByUser.get(r.user_id)) || (r.user_id||'').slice(0,8)+'…')}</td><td>${fmt(r.silver||0)}</td><td>${r.lvl||1}</td><td>${fmtAdmPlaytime(playtimeByUser.get(r.user_id)||0)}</td></tr>
  `).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;
  
  const rateRows = (wealth||[]).map(r => {
    const sec = playtimeByUser.get(r.user_id) || 0;
    const earned = Number(r.silver_earned||0);
    const hrs = sec / 3600;
    return { user_id:r.user_id, earned, sec, rate: hrs > 0.05 ? earned/hrs : 0 };
  }).filter(r => r.sec > 180).sort((a,b) => b.rate - a.rate).slice(0,15);
  const rateHtml = rateRows.map((r,i) => `
    <tr class="${i===0?'admTop':''}"><td>#${i+1}</td><td>${escapeHtml((nameByUser&&nameByUser.get(r.user_id)) || (r.user_id||'').slice(0,8)+'…')}</td>
      <td>${fmt(r.earned)}</td><td>${fmtAdmPlaytime(r.sec)}</td><td>${fmt(Math.round(r.rate))}/h</td></tr>
  `).join('') || `<tr><td colspan="5" class="admEmpty">${LANG==='fr'?'Pas encore de données (au moins 3 min de jeu requises)':'No data yet (at least 3 min playtime required)'}</td></tr>`;

  const cronRow = (byItem||[]).find(r => r.item_name === CRON_STONE.name);
  const cronTotalQty = cronRow ? Number(cronRow.total_qty||0) : null;
  const cronPickups = cronRow ? Number(cronRow.pickups||0) : null;
  const cronPlayerCount = (playerStats||[]).length;
  const cronAvgPerPlayer = (cronTotalQty != null && cronPlayerCount) ? cronTotalQty/cronPlayerCount : null;
  const CRON_TIER_LABEL = { grey:{fr:'Gris',en:'Grey'}, white:{fr:'Blanc',en:'White'}, green:{fr:'Vert',en:'Green'}, blue:{fr:'Bleu',en:'Blue'} };
  const cronCostRows = Object.entries(CRON_STONE_COST_BY_TIER).map(([grade,cost]) =>
    `<tr><td>${CRON_TIER_LABEL[grade][LANG]}</td><td>${cost}</td></tr>`).join('');
  const naTxt = LANG==='fr' ? 'Hors top 20' : 'Outside top 20';

  return {
    hourly: `<h3>${LANG==='fr'?'💰 Silver farmé par heure (48h)':'💰 Silver farmed per hour (48h)'}</h3>
      <div class="admBars">${hourHtml}</div>
      <h3>${LANG==='fr'?'👥 Joueurs actifs par heure (48h)':'👥 Active players per hour (48h)'}</h3>
      <div class="admSummary">${LANG==='fr'?'Nombre de joueurs distincts · temps de jeu cumulé':'Distinct player count · total playtime'}</div>
      <div class="admBars">${ptHourHtml}</div>`,
    items: `<table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Objet':'Item'}</th><th>${LANG==='fr'?'Type':'Kind'}</th><th>${LANG==='fr'?'Ramassages':'Pickups'}</th><th>Qté</th><th>Silver</th></tr></thead>
        <tbody>${itemHtml}</tbody>
      </table>`,
    wealth: `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'💰 Total en jeu':'💰 Total in game'}</div><div class="astVal">${fmt(totalSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne / joueur':'📊 Average / player'}</div><div class="astVal">${fmt(avgSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📍 Médiane':'📍 Median'}</div><div class="astVal">${fmt(medSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'👥 Joueurs':'👥 Players'}</div><div class="astVal">${silvers.length}</div></div>
      </div>
      <h3>${LANG==='fr'?'📈 Répartition des joueurs par richesse':'📈 Players by wealth bracket'}</h3>
      <div class="admHistBars">${histHtml}</div>
      <table class="admTable">
        <thead><tr><th>#</th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>Silver</th><th>Niv.</th><th>${LANG==='fr'?'Temps de jeu':'Playtime'}</th></tr></thead>
        <tbody>${wealthHtml}</tbody>
      </table>`,
    
    silver: `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🏦 Stocké (chez les joueurs)':'🏦 Stored (with players)'}</div><div class="astVal">${fmt(totalSilver)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📈 Gagné à vie (tous joueurs)':'📈 Lifetime earned (all players)'}</div><div class="astVal">${fmt(totalEarned)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🔻 Dépensé (sorti du jeu)':'🔻 Spent (sunk)'}</div><div class="astVal">${fmt(totalSpent)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne stockée / joueur':'📊 Average stored / player'}</div><div class="astVal">${fmt(avgSilver)}</div></div>
      </div>
      <div class="admHint">${LANG==='fr'
        ? 'Pour ajouter une nouvelle catégorie plus tard : passe-la en 3e argument d\'addSilver(delta, \'ma_categorie\', note) côté client, ET ajoute-la à la contrainte silver_ledger_category_check (migration Supabase, whitelist depuis le 2026-07-14 — voir issue GitHub #4) — sinon l\'insertion échoue silencieusement. Ajoute aussi son libellé dans CATEGORY_LABEL (admin-panel.js) pour un affichage propre ici.'
        : 'To add a new category later: pass it as the 3rd argument of addSilver(delta, \'my_category\', note) client-side, AND add it to the silver_ledger_category_check constraint (Supabase migration, whitelist since 2026-07-14 — see GitHub issue #4) — otherwise the insert silently fails. Also add its label to CATEGORY_LABEL (admin-panel.js) for a clean display here.'}</div>
      <h3>${LANG==='fr'?'🔍 Où partent les silver ? (registre détaillé)':'🔍 Where does the silver go? (detailed ledger)'}
        <button id="btnReloadSilverTab" class="admReloadBtn" title="${LANG==='fr'?'Rafraîchir sans rouvrir le panneau':'Refresh without reopening the panel'}">🔄 ${LANG==='fr'?'Recharger':'Reload'}</button></h3>
      <div class="admHint">${LANG==='fr'
        ? 'Chaque variation de silver (loot, potions, ventes, quêtes, succès, marché...) est journalisée individuellement dans le registre — tableau ci-dessous par catégorie, graphique par heure. Le marché reste un simple TRANSFERT entre joueurs (achat/vente/remboursement), pas un sink net.'
        : 'Every silver change (loot, potions, sales, quests, achievements, market...) is individually logged in the ledger — table below by category, hourly graph. The market remains a plain TRANSFER between players (buy/sell/refund), not a net sink.'}</div>
      <table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Catégorie':'Category'}</th><th>${LANG==='fr'?'Gagné':'Gained'}</th><th>${LANG==='fr'?'Dépensé':'Spent'}</th><th>${LANG==='fr'?'Mouvements':'Transactions'}</th><th>${LANG==='fr'?'Volume':'Volume'}</th></tr></thead>
        <tbody>${categoryHtml}</tbody>
      </table>
      <h3>${LANG==='fr'?'📊 Flux net de silver par heure (48h)':'📊 Net silver flow per hour (48h)'}</h3>
      <div class="admBars">${silverHourHtml}</div>
      <h3>${LANG==='fr'?'🏆 Qui gagne le plus vite ? (taux à vie)':'🏆 Who earns fastest? (lifetime rate)'}</h3>
      <div class="admSummary">${LANG==='fr'?'Silver gagné à vie ÷ temps de jeu total — classé par taux, pas par montant. Au moins 3 min de jeu requises.':'Lifetime silver earned ÷ total playtime — ranked by rate, not by amount. At least 3 min playtime required.'}</div>
      <table class="admTable">
        <thead><tr><th>#</th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>${LANG==='fr'?'Gagné à vie':'Lifetime earned'}</th><th>${LANG==='fr'?'Temps de jeu':'Playtime'}</th><th>${LANG==='fr'?'Taux':'Rate'}</th></tr></thead>
        <tbody>${rateHtml}</tbody>
      </table>`,
    cron: `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'⏳ Farmées (tous joueurs)':'⏳ Farmed (all players)'}</div><div class="astVal">${cronTotalQty!=null?fmt(cronTotalQty):naTxt}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🎒 Ramassages':'🎒 Pickups'}</div><div class="astVal">${cronPickups!=null?fmt(cronPickups):naTxt}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne / joueur':'📊 Average / player'}</div><div class="astVal">${cronAvgPerPlayer!=null?fmt(Math.round(cronAvgPerPlayer)):naTxt}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🎲 Chance/kill':'🎲 Chance/kill'}</div><div class="astVal">${(CRON_STONE.ch*100).toFixed(1)}%</div></div>
      </div>
      <div class="admHint">${LANG==='fr'
        ? 'Taux de drop FIXE, identique dans toutes les zones du jeu (pas de décroissance par zone comme le trash/matériaux) — 1 à 3 unités par ramassage. Les 3 premières tuiles viennent du même top 20 que l\'onglet "Ressources farmées" : "Hors top 20" si la Pierre de Cron n\'y figure pas encore (volume trop faible face au trash).'
        : 'FIXED drop rate, identical in every zone of the game (no per-zone decay like trash/materials) — 1 to 3 units per pickup. The first 3 tiles come from the same top 20 as the "Farmed resources" tab: "Outside top 20" if the Cron Stone isn\'t in it yet (too little volume next to trash).'}</div>
      <h3>${LANG==='fr'?'💎 Coût par palier de la pièce protégée':'💎 Cost by tier of the protected piece'}</h3>
      <div class="admHint">${LANG==='fr'
        ? 'Coût en Pierres de Cron pour protéger UNE tentative d\'optimisation contre une rétrogradation, selon le palier de la pièce ciblée (voir cronStoneCostForItem, game-core.js).'
        : 'Cron Stone cost to protect ONE enhancement attempt from a downgrade, based on the tier of the targeted piece (see cronStoneCostForItem, game-core.js).'}</div>
      <table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Palier':'Tier'}</th><th>${LANG==='fr'?'Coût':'Cost'}</th></tr></thead>
        <tbody>${cronCostRows}</tbody>
      </table>`,
  };
}

function buildLootVersionTabHtml() {
  const v = S.lootTableVersion || 'v2';
  const rows = [
    { grade:'grey', label:{fr:'Gris',en:'Grey'} }, { grade:'white', label:{fr:'Blanc',en:'White'} },
    { grade:'green', label:{fr:'Vert',en:'Green'} }, { grade:'blue', label:{fr:'Bleu',en:'Blue'} },
  ];
  const v2Table = `<table class="admTable"><thead><tr><th>${LANG==='fr'?'Palier':'Tier'}</th><th>${LANG==='fr'?'Armure/Arme':'Armor/Weapon'}</th><th>${LANG==='fr'?'Bijou':'Jewel'}</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td>${r.label[LANG]}</td><td>${(LOOT_RATES_V2[r.grade].gear*100).toFixed(2)}%</td><td>${(LOOT_RATES_V2[r.grade].jewel*100).toFixed(3)}%</td></tr>`).join('') +
    `</tbody></table>`;
  return `<div class="admSummary">${LANG==='fr'?'Version active :':'Active version:'} <b>${v.toUpperCase()}</b></div>
    <div class="admActions">
      <button id="btnLootVerV1" class="${v==='v1'?'ready':''}">${LANG==='fr'?'V1 — taux par zone (historique)':'V1 — per-zone rates (legacy)'}</button>
      <button id="btnLootVerV2" class="${v==='v2'?'ready':''}">${LANG==='fr'?'V2 — taux fixe par palier':'V2 — flat per-tier rate'}</button>
    </div>
    <div class="admHint">${LANG==='fr'
      ? 'V1 : chaque zone a son propre taux (décroissant zone après zone, voir GEAR_CHANCE). V2 : un seul taux par palier, appliqué à ses 4 zones. Change instantanément, réversible à tout moment, aucune donnée perdue.'
      : 'V1: each zone has its own rate (decreasing zone after zone, see GEAR_CHANCE). V2: a single rate per tier, applied to its 4 zones. Switches instantly, reversible anytime, no data lost.'}</div>
    <h3>${LANG==='fr'?'📋 Table V2':'📋 V2 table'}</h3>
    ${v2Table}`;
}
async function openAdminPanel() {
  if (!isAdmin() || !sb) return;
  
  const analyticsPromise = Promise.all([
    sb.from('admin_farm_by_hour').select('*'),
    sb.from('admin_farm_by_item').select('*').limit(20),
    sb.from('admin_wealth').select('*'),
    sb.from('admin_playtime_by_hour').select('*'),
    
    sb.from('admin_silver_ledger_by_category').select('*'),
    sb.from('admin_silver_ledger_by_hour').select('*'),
  ]);
  const [{data: stats}, {data: playersList}] = await Promise.all([
    sb.from('player_stats').select('user_id, playtime_sec, loyalty'),
    sb.rpc('admin_list_players'),
  ]);
  const playtimeByUser = new Map((stats||[]).map(r => [r.user_id, Number(r.playtime_sec||0)]));
  
  const nameByUser = new Map((playersList||[]).map(p => [p.user_id, p.display_name||'?']));
  
  const loyaltyVals = (stats||[]).map(r => Number(r.loyalty||0));
  const loyaltyTotal = loyaltyVals.reduce((a,b) => a+b, 0);
  const loyaltyAvg = loyaltyVals.length ? Math.round(loyaltyTotal/loyaltyVals.length) : 0;

  const playersHtml = (playersList||[]).map(p => `
    <tr>
      <td>${p.online ? '🟢' : '⚪'}</td><td>${escapeHtml(p.display_name||'?')}</td>
      <td>${fmt(p.silver||0)}</td><td>${p.gearscore||0}</td>
      <td title="${LANG==='fr'?'PA (Puissance d\'Attaque)':'AP (Attack Power)'}">${(p.ap||0).toFixed(1)}</td>
      <td title="${LANG==='fr'?'PD (Puissance de Défense)':'DP (Defense Power)'}">${(p.dp||0).toFixed(1)}</td>
      <td>${p.lvl||1}</td>
      <td title="${LANG==='fr'?'Record personnel de kills/min (à vie)':'Personal kills/min record (lifetime)'}">🏹 ${(p.best_kpm||0).toFixed(1)}</td>
      <td><button class="admUuidBtn" data-uuid="${p.user_id}">📋 UUID</button></td>
      <td><button class="admInvBtn" data-uuid="${p.user_id}" data-name="${escapeHtml(p.display_name||'?')}" title="${LANG==='fr'?'Ouvre l\'équipement porté et le sac complet (192 cases) de ce joueur, en lecture seule, dans une nouvelle fenêtre':'Opens this player\'s equipped gear and full bag (192 slots), read-only, in a new window'}">🎒 ${LANG==='fr'?'Inventaire':'Inventory'}</button></td>
    </tr>`).join('') || `<tr><td colspan="10" class="admEmpty">${LANG==='fr'?'Pas encore de données':'No data yet'}</td></tr>`;
  const loadingHtml = `<div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div>`;
  const cats = [
    { id:'players', icon:'👥', label:{fr:'Joueurs',en:'Players'},
      body: `<div class="admSummary">${LANG==='fr'?`${(playersList||[]).filter(p=>p.online).length} en ligne · ${(playersList||[]).length} inscrits`:`${(playersList||[]).filter(p=>p.online).length} online · ${(playersList||[]).length} registered`}</div>
      <table class="admTable">
        <thead><tr><th></th><th>${LANG==='fr'?'Joueur':'Player'}</th><th>Silver</th><th>GS</th><th title="${LANG==='fr'?'PA':'AP'}">PA</th><th title="${LANG==='fr'?'PD':'DP'}">PD</th><th>Niv.</th><th title="${LANG==='fr'?'Record kills/min':'Kills/min record'}">🏹</th><th></th><th></th></tr></thead>
        <tbody>${playersHtml}</tbody>
      </table>` },
    { id:'hourly', icon:'💰', label:{fr:'Silver & temps de jeu / heure',en:'Silver & playtime / hour'}, body: loadingHtml },
    { id:'silver', icon:'🏦', label:{fr:'Silver',en:'Silver'}, body: loadingHtml },
    { id:'items', icon:'📦', label:{fr:'Ressources farmées',en:'Farmed resources'}, body: loadingHtml },
    { id:'wealth', icon:'👑', label:{fr:'Richesses',en:'Wealth'}, body: loadingHtml },
    { id:'treasure', icon:'🗺️', label:{fr:'Trésor de Velia',en:'Velia Treasure'},
      
      body: `<div class="admSummary">${LANG==='fr'
        ? `Estimation à ${ADMIN_TREASURE_KPM_REF} kills/min (compare à ton propre "Kills/min" affiché en jeu)`
        : `Estimate at ${ADMIN_TREASURE_KPM_REF} kills/min (compare to your own in-game "Kills/min")`}</div>
      <table class="admTable">
        <thead><tr><th>${LANG==='fr'?'Objet':'Item'}</th><th>${LANG==='fr'?'Chance/kill':'Chance/kill'}</th>
          <th>${LANG==='fr'?'Kills en moyenne':'Avg kills'}</th><th>${LANG==='fr'?'Temps estimé':'Est. time'}</th></tr></thead>
        <tbody>${VELIA_TREASURE.map(t => {
          const avgKills = Math.round(1/t.ch);
          const avgMin = avgKills / ADMIN_TREASURE_KPM_REF;
          return `<tr><td><span style="color:${t.color}">${t.icon}</span> ${tr(t.name)}</td><td>${fmtTinyPct(t.ch)}</td>` +
            `<td>${fmt(avgKills)}</td><td>${fmtDurationMin(avgMin)}</td></tr>`;
        }).join('')}</tbody>
      </table>` },
    
    { id:'cron', icon:'⏳', label:{fr:'Pierres de Cron',en:'Cron Stones'}, body: loadingHtml },
    { id:'loyalty', icon:'🏅', label:{fr:'Loyalties',en:'Loyalties'},
      
      body: `<div class="admStatTiles">
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'🏅 Total en jeu':'🏅 Total in game'}</div><div class="astVal">${fmt(loyaltyTotal)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'📊 Moyenne / joueur':'📊 Average / player'}</div><div class="astVal">${fmt(loyaltyAvg)}</div></div>
        <div class="admStatTile"><div class="astLbl">${LANG==='fr'?'👥 Joueurs':'👥 Players'}</div><div class="astVal">${loyaltyVals.length}</div></div>
      </div>
      <h3>${LANG==='fr'?'🛍️ Utilisées pour':'🛍️ Used to buy'}</h3>
      <div class="admEmpty">${LANG==='fr'
        ? 'Aucune boutique Loyalties en jeu pour l\'instant — rien à dépenser, ces stats servent à suivre l\'accumulation avant d\'ouvrir une boutique.'
        : 'No Loyalties shop in game yet — nothing to spend it on, these stats track accumulation ahead of opening a shop.'}</div>` },
    
    { id:'loot', icon:'🎲', label:{fr:'Table de loot',en:'Loot table'}, body: buildLootVersionTabHtml() },
  ];
  const tabsHtml = cats.map((c,i) => `<button class="catTab${i===0?' active':''}" data-cat="${c.id}">${c.icon} ${c.label[LANG]}</button>`).join('');
  const panesHtml = cats.map((c,i) => `<div class="catPane" data-cat="${c.id}"${i===0?'':' style="display:none"'}>${c.body}</div>`).join('');
  
  let cachedAnalytics = null;
  
  function wireSilverReloadBtn() {
    const btn = $a('btnReloadSilverTab'); if (!btn) return;
    btn.onclick = async () => {
      if (!cachedAnalytics) return;
      btn.disabled = true; const oldTxt = btn.textContent; btn.textContent = '🔄 …';
      const [{data: silverByCategory}, {data: silverByHour}] = await Promise.all([
        sb.from('admin_silver_ledger_by_category').select('*'),
        sb.from('admin_silver_ledger_by_hour').select('*'),
      ]);
      const html = buildAdminAnalyticsHtml(cachedAnalytics.byHour, cachedAnalytics.byItem, cachedAnalytics.wealth, playtimeByUser, cachedAnalytics.playtimeByHour, nameByUser, silverByCategory, silverByHour);
      const body = $a('infoBody'); if (!body) return; 
      const silverPane = body.querySelector('.catPane[data-cat="silver"]');
      if (silverPane) silverPane.innerHTML = html.silver;
      wireSilverReloadBtn(); 
      btn.disabled = false; btn.textContent = oldTxt;
    };
  }
  analyticsPromise.then(([{data: byHour}, {data: byItem}, {data: wealth}, {data: playtimeByHour}, {data: silverByCategory}, {data: silverByHour}]) => {
    cachedAnalytics = { byHour, byItem, wealth, playtimeByHour };
    const html = buildAdminAnalyticsHtml(byHour, byItem, wealth, playtimeByUser, playtimeByHour, nameByUser, silverByCategory, silverByHour, stats);
    const body = $a('infoBody'); if (!body) return; 
    const hourlyPane = body.querySelector('.catPane[data-cat="hourly"]');
    const itemsPane = body.querySelector('.catPane[data-cat="items"]');
    const wealthPane = body.querySelector('.catPane[data-cat="wealth"]');
    const silverPane = body.querySelector('.catPane[data-cat="silver"]');
    const cronPane = body.querySelector('.catPane[data-cat="cron"]');
    if (hourlyPane) hourlyPane.innerHTML = html.hourly;
    if (itemsPane) itemsPane.innerHTML = html.items;
    if (wealthPane) wealthPane.innerHTML = html.wealth;
    if (silverPane) silverPane.innerHTML = html.silver;
    if (cronPane) cronPane.innerHTML = html.cron;
    wireSilverReloadBtn();
  }).catch(()=>{});
  
  const bossOptions = Object.keys(BOSS_ROSTER).map(id => `<option value="${id}">${BOSS_ROSTER[id].icon} ${BOSS_ROSTER[id].short[LANG]}</option>`).join('');
  
  const adminTopTabs = [
    { id:'moi', icon:'👤', label:{fr:'Moi',en:'Me'} },
    { id:'joueur', icon:'🎯', label:{fr:'Joueur précis',en:'Specific player'} },
    { id:'serveur', icon:'🌍', label:{fr:'Serveur',en:'Server'} },
    { id:'stats', icon:'📊', label:{fr:'Stats',en:'Stats'} },
  ];
  const adminTopTabsHtml = adminTopTabs.map((t,i) => `<button class="catTab${i===0?' active':''}" data-top="${t.id}">${t.icon} ${t.label[LANG]}</button>`).join('');
  const actionsHtml = `
    <div class="admRiskLegend">
      <span><i style="background:#5a8fc8"></i>${LANG==='fr'?'Bleu = sans risque, perso':'Blue = safe, personal'}</span>
      <span><i style="background:var(--danger)"></i>${LANG==='fr'?'Rouge = touche TOUS les joueurs':'Red = affects ALL players'}</span>
      <span><i style="background:#7aa35e"></i>${LANG==='fr'?'Vert = gestion (rôles, boutons verrouillés)':'Green = management (roles, locked buttons)'}</span>
    </div>
    <div class="catTabs admTopTabs">${adminTopTabsHtml}</div>
    <div class="admTopPane" data-top="moi">
      <div class="admSection riskSafe">
        <div class="admSectionTitle">👤 ${LANG==='fr'?'Pour moi — test sur mon compte':'For me — test on my account'}</div>
        <div class="admSectionSub">${LANG==='fr'?'Sans danger : ça ne touche que TON propre personnage.':'Safe: only affects YOUR own character.'}</div>
        <div class="admActions">
          <button id="btnTestSilver">💰 +1M silver</button>
          <button id="btnTestLoyalty">📬 +200 Loyalties</button>
          <button id="btnTestAch">🏅 ${LANG==='fr'?'Débloquer tous les succès':'Unlock all achievements'}</button>
          <button id="btnResetMyQuests" data-i18n="btnResetMyQuests">🔄 Réinitialiser mes quêtes</button>
          <button id="btnResetDemo" data-i18n="btnResetDemo">🔄 Réinitialiser la démo</button>
        </div>
        <div class="admBossSpawn">
          <span>${LANG==='fr'?'⚔️ Combattre un World Boss :':'⚔️ Fight a World Boss:'}</span>
          <select id="admBossSelect">${bossOptions}</select>
          <button id="btnAdmSpawnBoss">${LANG==='fr'?'Combattre maintenant':'Fight now'}</button>
        </div>
        <div class="admHint">${LANG==='fr'?'Lance un vrai boss partagé (PV communs) rien que pour toi, pour tester sans attendre le planning ni prévenir personne.':'Spawns a real shared boss (common HP) just for you, to test without waiting for the schedule or notifying anyone.'}</div>
      </div>
    </div>
    <div class="admTopPane" data-top="joueur" style="display:none">
      <div class="admSection riskSingle">
        <div class="admSectionTitle">🎯 ${LANG==='fr'?'Un joueur précis — par UUID':'A specific player — by UUID'}</div>
        <div class="admSectionSub">⚠️ ${LANG==='fr'?'Efface silver/équipement/niveau/sac de CE joueur uniquement.':'Wipes silver/gear/level/bag for THAT player only.'}</div>
        <div class="admActions">
          <input type="text" id="admResetUuidInput" placeholder="${LANG==='fr'?'UUID du joueur':'Player UUID'}" style="width:230px">
          <button id="btnScreenshotPlayer">📸 ${LANG==='fr'?'Screenshot':'Screenshot'}</button>
          <button id="btnResetAccountByUuid" style="border-color:var(--danger);color:#e8a89f">🔄 ${LANG==='fr'?'Réinitialiser ce joueur':'Reset this player'}</button>
        </div>
        <div class="admHint">${LANG==='fr'?'Trouve l\'UUID d\'un joueur via le Classement ou ses messages en jeu (bouton "Copier UUID" dans son propre menu). "Screenshot" affiche son équipement/inventaire en lecture seule (aucune modification). Le reset envoie le même message d\'explication que le reset global, mais montré UNIQUEMENT à ce joueur.':'Find a player\'s UUID via the Leaderboard or their in-game messages (the "Copy UUID" button in their own menu). "Screenshot" shows their gear/inventory read-only (no changes made). The reset sends the same explanation message as the global reset, but shown ONLY to that player.'}</div>
      </div>
      <div class="admSection riskMgmt">
        <div class="admSectionTitle">🎭 ${LANG==='fr'?'Rôles (Modérateur / Testeur)':'Roles (Moderator / Tester)'}</div>
        <div class="admSectionSub">${LANG==='fr'?'🛡️ Modérateur : peut supprimer des messages de chat. 🧪 Testeur : accès en avant-première aux fonctionnalités pas encore publiques. Un joueur peut cumuler les deux.':'🛡️ Moderator: can delete chat messages. 🧪 Tester: early access to not-yet-public features. A player can hold both roles.'}</div>
        <div class="admBossSpawn">
          <input type="text" id="admRoleUuid" placeholder="${LANG==='fr'?'UUID du joueur':'Player UUID'}" style="flex:1;min-width:180px;background:#0d0c11;border:1px solid #333;color:var(--ink);padding:5px 7px;font-family:monospace;font-size:11px;border-radius:3px;">
          <select id="admRoleSelect" style="flex:0 0 auto;width:auto;">
            <option value="mod">🛡️ ${LANG==='fr'?'Modérateur':'Moderator'}</option>
            <option value="tester">🧪 ${LANG==='fr'?'Testeur':'Tester'}</option>
          </select>
          <button id="btnAddRole" style="flex:0 0 auto;width:auto;">${LANG==='fr'?'➕ Ajouter':'➕ Add'}</button>
        </div>
        <div id="admRoleList"><div class="admEmpty">${LANG==='fr'?'Chargement…':'Loading…'}</div></div>
      </div>
    </div>
    <div class="admTopPane" data-top="serveur" style="display:none">
      <div class="admSection riskGlobal">
        <div class="admSectionTitle">🌍 ${LANG==='fr'?'Pour les joueurs — actions serveur':'For players — server-wide'}</div>
        <div class="admSectionSub">⚠️ ${LANG==='fr'?'Danger : ces actions touchent TOUS les joueurs connectés.':'Danger: these actions affect ALL connected players.'}</div>
        <div class="admActions">
          <button id="btnResetAllQuests" data-i18n="btnResetAllQuests">⚠️ Réinitialiser les quêtes de tous</button>
          <button id="btnResetAllAccounts" style="border-color:var(--danger);color:#e8a89f">💥 ${LANG==='fr'?'Réinitialiser TOUS les comptes':'Reset ALL accounts'}</button>
        </div>
        <div class="admHint warn">${LANG==='fr'?'"Réinitialiser TOUS les comptes" efface silver/équipement/niveau/sac de TOUT LE MONDE et affiche un message d\'explication à chaque joueur à sa prochaine connexion. Irréversible.':'"Reset ALL accounts" wipes silver/gear/level/bag for EVERYONE and shows an explanation message to each player on their next login. Irreversible.'}</div>
        <div class="admBossSpawn">
          <span>${LANG==='fr'?'🌍 Lancer un boss pour TOUS :':'🌍 Launch a boss for ALL:'}</span>
          <select id="admGlobalBossSelect">${bossOptions}</select>
          <select id="admBossDurationSelect">
            ${[2,3,4,5,6,7].map(m => `<option value="${m}"${m===4?' selected':''}>${LANG==='fr'?`~${m} min à tuer`:`~${m} min to kill`}</option>`).join('')}
          </select>
          <button id="btnAdmSpawnGlobal">${LANG==='fr'?'Lancer (9 min)':'Launch (9 min)'}</button>
          <button id="btnAdmDespawnBoss">🛑 ${LANG==='fr'?'Faire disparaître':'Despawn'}</button>
        </div>
        <div class="admHint">${LANG==='fr'?'Les PV sont calculés selon le nombre de joueurs en ligne pour viser la durée choisie (la durée réelle dépendra du stuff et du nombre de participants réels). Le boss disparaît de toute façon au bout de 9 minutes.':'HP is calculated from current online players to target the chosen duration (actual time will depend on gear and real participation). The boss despawns after 9 minutes regardless.'}</div>
      </div>
      <!-- fermeture d'urgence du marché + annulation en masse (2026-07-16, demande explicite :
           "Annuler toute ordre au marché les rendre au joueurs. bloquer l'acces au marché laisse
           lacces a admin") -- get_market_open()/admin_set_market_open()/admin_cancel_all_market_orders(),
           voir la migration market_lockdown_and_cancel_all. L'admin garde toujours l'accès au
           marché même quand il est "fermé" pour les autres (voir market_place_order côté serveur). -->
      <div class="admSection riskGlobal">
        <div class="admSectionTitle">🏛️ ${LANG==='fr'?'Marché':'Market'}</div>
        <div class="admSectionSub">⚠️ ${LANG==='fr'?'Ferme l\'accès au Marché pour TOUT LE MONDE sauf toi ; l\'annulation rembourse chaque ordre ouvert (silver ou objet) à son propriétaire.':'Closes Market access for EVERYONE except you; cancelling refunds every open order (silver or item) to its owner.'}</div>
        <div class="admActions">
          <button id="btnMarketToggle">${LANG==='fr'?'Chargement…':'Loading…'}</button>
          <button id="btnMarketCancelAll" style="border-color:var(--danger);color:#e8a89f">💥 ${LANG==='fr'?'Annuler tous les ordres ouverts':'Cancel all open orders'}</button>
        </div>
        <div id="admMarketStatus" class="admHint"></div>
      </div>
    </div>
`;
  const statsTopPane = `<div class="admTopPane" data-top="stats" style="display:none"><div class="catTabs">${tabsHtml}</div>${panesHtml}</div>`;
  openInfo(LANG==='fr' ? '🛠️ Zone Admin' : '🛠️ Admin Zone', actionsHtml + statsTopPane);
  applyI18n();
  wireCatTabs();
  
  function wireLootVersionButtons() {
    const v1Btn = $a('btnLootVerV1'), v2Btn = $a('btnLootVerV2');
    if (v1Btn) v1Btn.onclick = () => { if(!isAdmin())return; S.lootTableVersion = 'v1'; const pane = $a('infoBody').querySelector('.catPane[data-cat="loot"]'); if (pane) pane.innerHTML = buildLootVersionTabHtml(); wireLootVersionButtons(); floatTxt(P.x,P.y,100,'Loot V1',{blue:true}); };
    if (v2Btn) v2Btn.onclick = () => { if(!isAdmin())return; S.lootTableVersion = 'v2'; const pane = $a('infoBody').querySelector('.catPane[data-cat="loot"]'); if (pane) pane.innerHTML = buildLootVersionTabHtml(); wireLootVersionButtons(); floatTxt(P.x,P.y,100,'Loot V2',{gold:true}); };
  }
  wireLootVersionButtons();
  
  $a('infoBody').querySelectorAll('.admTopTabs .catTab').forEach(btn => {
    btn.onclick = () => {
      const top = btn.dataset.top;
      $a('infoBody').querySelectorAll('.admTopTabs .catTab').forEach(b => b.classList.toggle('active', b === btn));
      $a('infoBody').querySelectorAll('.admTopPane').forEach(p => p.style.display = p.dataset.top === top ? '' : 'none');
    };
  });
  refreshRoleList();
  
  $a('infoBody').querySelectorAll('.admUuidBtn').forEach(btn => {
    btn.onclick = async e => {
      e.stopPropagation();
      try { await navigator.clipboard.writeText(btn.dataset.uuid); } catch(e) {}
      floatTxt(P.x, P.y, 100, LANG==='fr'?'UUID copié ✓':'UUID copied ✓', { gold:true });
    };
  });
  
  $a('infoBody').querySelectorAll('.admInvBtn').forEach(btn => {
    btn.onclick = e => { e.stopPropagation(); showPlayerInventoryWindow(btn.dataset.uuid, btn.dataset.name); };
  });
  
  $a('btnTestSilver').onclick = () => { if(!isAdmin())return; addSilver(1000000, 'admin_test'); refreshStatsOnly(); floatTxt(P.x,P.y,100,'+1M 🪙',{gold:true}); };
  $a('btnTestLoyalty').onclick = () => { if(!isAdmin())return; mailboxAdd('loyalty', 'Loyalties', '🏅', 200); updateMailBadge(); floatTxt(P.x,P.y,100,'+200 🏅 (courrier)',{gold:true}); };
  
  $a('btnTestAch').onclick = () => { if(!isAdmin())return; ACHIEVEMENTS.forEach(a => { if(!S.achUnlocked[a.id]){ S.achUnlocked[a.id]=Date.now(); addSilver(a.reward, 'admin_test', a.name.fr); } }); refreshStatsOnly(); openAdminPanel(); };
  $a('btnResetMyQuests').onclick = resetMyQuests;
  $a('btnResetDemo').onclick = resetDemo;
  
  async function adminSpawnSharedBoss(id, targetMin) {
    if (!sb) return false;
    let onlineTotal = 1;
    try {
      const { data } = await sb.rpc('get_online_counts', { p_window_seconds: 90 });
      if (data && data[0]) onlineTotal = Math.max(1, data[0].total || 1);
    } catch (e) {}
    const expectedFighters = Math.max(1, Math.round(onlineTotal * 0.4));
    const sharedHp = Math.round(BOSS_REF_DPS * expectedFighters * targetMin * 60);
    const { error } = await sb.rpc('admin_spawn_boss', { p_boss_id: id, p_minutes: 9, p_hp: sharedHp });
    if (!error) await refreshLiveBoss();
    return !error;
  }
  $a('btnAdmSpawnBoss').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const id = $a('admBossSelect').value;
    const ok = await adminSpawnSharedBoss(id, 4);
    if (!ok) { floatTxt(P.x, P.y, 100, LANG==='fr'?'Échec du lancement':'Failed to launch', { hurt:true }); return; }
    $a('infoOverlay').classList.remove('open');
    startBossFight(id, true); 
  };
  
  $a('btnResetAccountByUuid').onclick = resetAccountByUuid;
  $a('btnScreenshotPlayer').onclick = adminScreenshotPlayer;
  
  $a('btnResetAllQuests').onclick = resetAllQuests;
  $a('btnResetAllAccounts').onclick = resetAllAccounts;
  $a('btnAdmSpawnGlobal').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const id = $a('admGlobalBossSelect').value;
    const targetMin = Number($a('admBossDurationSelect').value) || 4;
    const ok = await adminSpawnSharedBoss(id, targetMin);
    if (ok) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a lancé ${BOSS_ROSTER[id].name.fr} pour tous (~${targetMin} min)`, 0x9cc9e8);
    floatTxt(P.x, P.y, 100, ok ? (LANG==='fr'?'Boss lancé pour tous ✓':'Boss launched for all ✓') : (LANG==='fr'?'Échec du lancement':'Failed to launch'), { gold:ok, hurt:!ok });
  };
  $a('btnAdmDespawnBoss').onclick = async () => {
    if (!isAdmin() || !sb) return;
    if (!confirm(LANG==='fr'?'Faire disparaître le boss mondial pour TOUS les joueurs ?':'Despawn the world boss for ALL players?')) return;
    const { error } = await sb.rpc('admin_despawn_boss');
    if (!error) { await refreshLiveBoss(); logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a fait disparaître le boss mondial`, 0x9cc9e8); }
    floatTxt(P.x, P.y, 100, !error ? (LANG==='fr'?'Boss disparu ✓':'Boss despawned ✓') : (LANG==='fr'?'Échec':'Failed'), { gold:!error, hurt:!!error });
  };
  
  async function refreshMarketAdminStatus() {
    const btn = $a('btnMarketToggle'); if (!btn) return;
    const { data } = await sb.rpc('get_market_open');
    const open = data !== false;
    btn.textContent = open
      ? (LANG==='fr'?'🔓 Marché ouvert (clique pour fermer)':'🔓 Market open (click to close)')
      : (LANG==='fr'?'🔒 Marché fermé (clique pour rouvrir)':'🔒 Market closed (click to reopen)');
    btn.style.borderColor = open ? '' : 'var(--danger)';
    btn.style.color = open ? '' : '#e8a89f';
  }
  refreshMarketAdminStatus();
  $a('btnMarketToggle').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const { data } = await sb.rpc('get_market_open');
    const nextOpen = data === false;
    const { error } = await sb.rpc('admin_set_market_open', { p_open: nextOpen });
    if (!error) {
      logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a ${nextOpen?'rouvert':'fermé'} le Marché`, 0x9cc9e8);
      await refreshMarketAdminStatus();
    }
    floatTxt(P.x, P.y, 100, !error ? (nextOpen?(LANG==='fr'?'Marché rouvert ✓':'Market reopened ✓'):(LANG==='fr'?'Marché fermé ✓':'Market closed ✓')) : (LANG==='fr'?'Échec':'Failed'), { gold:!error, hurt:!!error });
  };
  $a('btnMarketCancelAll').onclick = async () => {
    if (!isAdmin() || !sb) return;
    if (!confirm(LANG==='fr'
      ? '💥 Annuler TOUS les ordres ouverts du Marché ? Chaque ordre sera remboursé (silver ou objet) à son propriétaire. Irréversible.'
      : '💥 Cancel ALL open Market orders? Each order will be refunded (silver or item) to its owner. Irreversible.')) return;
    const { data, error } = await sb.rpc('admin_cancel_all_market_orders');
    if (!error) logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a annulé ${data} ordre(s) de marché (remboursés)`, 0xc05545);
    const msg = error ? (LANG==='fr'?'Échec — '+error.message:'Failed — '+error.message)
      : (LANG==='fr'?`${data} ordre(s) annulé(s) et remboursé(s) ✓`:`${data} order(s) cancelled and refunded ✓`);
    $a('admMarketStatus').textContent = msg;
    floatTxt(P.x, P.y, 100, msg, { gold:!error, hurt:!!error });
  };
  
  $a('btnAddRole').onclick = async () => {
    if (!isAdmin() || !sb) return;
    const uuid = $a('admRoleUuid').value.trim(); if (!uuid) return;
    const role = $a('admRoleSelect').value;
    const rpc = role === 'mod' ? 'admin_add_mod' : 'admin_add_tester';
    const { error } = await sb.rpc(rpc, { p_user_id: uuid });
    if (error) { $a('admRoleList').insertAdjacentHTML('afterbegin', `<div class="admHint">${error.message}</div>`); return; }
    logToDiscord('🛠️ Admin', `**${myPseudo||'Admin'}** a ajouté le rôle ${role==='mod'?'Modérateur':'Testeur'} à \`${uuid}\``, 0x9cc9e8);
    $a('admRoleUuid').value = ''; refreshRoleList();
  };
}

async function refreshRoleList() {
  const el = $a('admRoleList'); if (!el || !sb) return;
  const [{ data: mods, error: modErr }, { data: testers, error: testErr }] = await Promise.all([
    sb.rpc('admin_list_mods'), sb.rpc('admin_list_testers'),
  ]);
  if (modErr || testErr) { el.innerHTML = `<div class="admHint">${escapeHtml((modErr||testErr).message)}</div>`; return; }
  const byUser = new Map();
  (mods || []).forEach(m => byUser.set(m.user_id, { ...(byUser.get(m.user_id)||{}), user_id:m.user_id, pseudo:m.pseudo, mod:true }));
  (testers || []).forEach(m => byUser.set(m.user_id, { ...(byUser.get(m.user_id)||{}), user_id:m.user_id, pseudo:m.pseudo, tester:true }));
  const rows = [...byUser.values()];
  if (!rows.length) { el.innerHTML = `<div class="admEmpty">${LANG==='fr'?'Aucun rôle attribué':'No roles assigned'}</div>`; return; }
  el.innerHTML = rows.map(r => `<div class="modRow">` +
    `<span class="modPseudo">${escapeHtml(r.pseudo || (LANG==='fr'?'(sans pseudo)':'(no nickname)'))}</span>` +
    `<code class="modUuid">${r.user_id}</code>` +
    `<span class="roleBadges">${r.mod?'🛡️ MOD':''}${r.mod&&r.tester?' · ':''}${r.tester?'🧪 Testeur':''}</span>` +
    `${r.mod?`<button class="modRemBtn" data-uuid="${r.user_id}" data-role="mod">${LANG==='fr'?'Retirer MOD':'Remove MOD'}</button>`:''}` +
    `${r.tester?`<button class="modRemBtn" data-uuid="${r.user_id}" data-role="tester">${LANG==='fr'?'Retirer Testeur':'Remove Tester'}</button>`:''}` +
    `</div>`).join('');
  el.querySelectorAll('.modRemBtn').forEach(btn => {
    btn.onclick = async () => {
      const rpc = btn.dataset.role === 'mod' ? 'admin_remove_mod' : 'admin_remove_tester';
      const { error } = await sb.rpc(rpc, { p_user_id: btn.dataset.uuid });
      if (!error) refreshRoleList();
    };
  });
}
$a('btnAdmin').onclick = openAdminPanel;

function openTesterPanel() {
  if (!myIsTester) return;
  const upcoming = [
    { icon:'🎣', name:{fr:'Pêche',en:'Fishing'} },
    { icon:'⛏️', name:{fr:'Mine',en:'Mining'} },
    { icon:'🌲', name:{fr:'Forêt',en:'Forest'} },
    { icon:'🌾', name:{fr:'Champs',en:'Fields'} },
    { icon:'🐑', name:{fr:'Bergerie',en:'Ranch'} },
  ];
  const list = upcoming.map(a => `<div class="achRow inactive"><div class="achIcon">${a.icon}</div>` +
    `<div class="achInfo"><div class="achName">${a.name[LANG]}</div><div class="achDesc">${LANG==='fr'?'En développement — bientôt en test':'In development — testable soon'}</div></div></div>`).join('');
  openInfo(LANG==='fr'?'🧪 Panneau Testeur':'🧪 Tester Panel',
    `<div class="admSummary">${LANG==='fr'
      ? 'Merci de tester Black Desert Idle ! Ce panneau te donnera accès aux nouveautés en avant-première (sans aucun avantage en jeu — c\'est du test pur). Rien à tester pour l\'instant, mais voici ce qui arrive :'
      : 'Thanks for testing Black Desert Idle! This panel gives you early access to new features (no in-game advantage — pure testing). Nothing to test yet, but here\'s what\'s coming:'}</div>` +
    list);
}
$a('btnTester').onclick = openTesterPanel;

// ==== src/social/chat.js ====
const CHAT_CHANNELS = [
  { id:'mondial', icon:'🌍', label:{fr:'Mondial',en:'World'} },
  { id:'trade',   icon:'💱', label:{fr:'Trade',en:'Trade'} },
  
  { id:'english', icon:'🇬🇧', label:{fr:'Anglais',en:'English'} },
  { id:'annonce', icon:'📢', label:{fr:'Annonce',en:'Announcement'} },
  { id:'modéré',  icon:'🛡️', label:{fr:'Modéré',en:'Moderated'}, staff:true }, 
];

let chatChannel = 'mondial', chatFolded = isMobileViewport(), chatPollTimer = null;
try { chatChannel = localStorage.getItem('velia-idle-chat-channel') || 'mondial'; } catch(e) {}
try { const v = localStorage.getItem('velia-idle-chat-folded'); if (v !== null) chatFolded = v === '1'; } catch(e) {}
let chatLastRead = {}; 
let chatUnread = {};   
let chatLastPingedAt = {}; 
function chatVisibleChannels() { return CHAT_CHANNELS.filter(c => !c.staff || isAdmin() || myIsMod); }
function renderChatTabs() {
  const el = $a('chatTabs'); if (!el) return;
  const chans = chatVisibleChannels();
  if (!chans.some(c => c.id === chatChannel)) chatChannel = 'mondial'; 
  el.innerHTML = chans.map(c => `<button class="catTab chan-${c.id==='modéré'?'annonce':c.id}${c.id===chatChannel?' active':''}${chatUnread[c.id]?' unread':''}" data-chan="${c.id}">${c.icon} ${c.label[LANG]}</button>`).join('');
  el.querySelectorAll('.catTab').forEach(btn => {
    btn.onclick = () => {
      chatChannel = btn.dataset.chan;
      try { localStorage.setItem('velia-idle-chat-channel', chatChannel); } catch(e) {}
      chatUnread[chatChannel] = false;
      el.querySelectorAll('.catTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      btn.classList.remove('unread');
      updateChatInputVisibility();
      fetchChatMessages();
    };
  });
}
function toggleChatFold() {
  chatFolded = !chatFolded;
  try { localStorage.setItem('velia-idle-chat-folded', chatFolded ? '1' : '0'); } catch(e) {}
  $a('chatBody').style.display = chatFolded ? 'none' : '';
  $a('chatFoldBtn').textContent = chatFolded ? '▸' : '▾';
  
  if (!chatFolded) { fetchChatMessages(); $a('chatWidget').classList.remove('pinged'); }
}
function updateChatInputVisibility() {
  const row = $a('chatInputRow'), note = $a('chatNote');
  if (chatChannel === 'modéré') {
    row.style.display = 'none';
    note.textContent = LANG==='fr' ? '🛡️ Journal des messages supprimés (staff)' : '🛡️ Deleted-message log (staff)';
  } else if (!currentUser || isGuest()) {
    row.style.display = 'none';
    note.textContent = LANG==='fr' ? '🔒 Connecte-toi avec un compte vérifié pour discuter' : '🔒 Sign in with a verified account to chat';
  } else if (chatChannel === 'annonce' && !isAdmin()) {
    row.style.display = 'none';
    note.textContent = LANG==='fr' ? 'Seul le staff peut poster ici' : 'Only staff can post here';
  } else {
    row.style.display = '';
    note.textContent = '';
  }
}

function fmtChatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const hhmm = d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
  const sameDay = d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
  return sameDay ? hhmm : (d.getDate().toString().padStart(2,'0')+'/'+(d.getMonth()+1).toString().padStart(2,'0')+' '+hhmm);
}

let chatExpandedDays = new Set();
function dayKeyOf(iso) { const d = new Date(iso); return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate(); }
function fmtDaySeparator(iso) {
  const d = new Date(iso), now = new Date(), yest = new Date(now); yest.setDate(yest.getDate()-1);
  if (dayKeyOf(iso) === dayKeyOf(now.toISOString())) return LANG==='fr' ? "Aujourd'hui" : 'Today';
  if (dayKeyOf(iso) === dayKeyOf(yest.toISOString())) return LANG==='fr' ? 'Hier' : 'Yesterday';
  return d.toLocaleDateString(LANG==='fr'?'fr-FR':'en-US', { weekday:'long', day:'numeric', month:'long' });
}
function renderChatMessages(msgs, sinceTs) {
  const el = $a('chatMessages'); if (!el) return;
  const canDelete = isAdmin() || myIsMod; 
  if (!msgs.length) { el.innerHTML = `<div class="chatEmpty">${LANG==='fr'?'Aucun message pour l\'instant':'No messages yet'}</div>`; return; }
  
  const dayGroups = [];
  for (const m of msgs) {
    const key = dayKeyOf(m.created_at);
    let g = dayGroups[dayGroups.length-1];
    if (!g || g.key !== key) { g = { key, msgs: [] }; dayGroups.push(g); }
    g.msgs.push(m);
  }
  const lastKey = dayGroups[dayGroups.length-1].key;
  el.innerHTML = dayGroups.map(g => {
    const isLast = g.key === lastKey;
    const expanded = isLast || chatExpandedDays.has(g.key);
    const bar = `<div class="chatDaySep${isLast?' current':''}" data-day="${g.key}">` +
      `<span class="chatDaySepLine"></span><span class="chatDaySepLabel">${fmtDaySeparator(g.msgs[0].created_at)}` +
      `${isLast?'':` (${g.msgs.length}) ${expanded?'▾':'▸'}`}</span><span class="chatDaySepLine"></span></div>`;
    const rows = !expanded ? '' : g.msgs.map(m => {
      
      const badge = m.role === 'admin' ? '<span class="chatBadge admin">ADMIN</span> '
        : m.role === 'mod' ? '<span class="chatBadge mod">MOD</span> ' : '';
      const del = (canDelete && m.id != null) ? `<button class="chatDelBtn" data-id="${m.id}" title="Supprimer">✕</button>` : '';
      
      const pseudoHtml = chatChannel === 'annonce' ? '' :
        `<span class="chatPseudo">${escapeHtml(m.pseudo || (m.role==='admin'?'Admin':(LANG==='fr'?'Joueur':'Player')))}</span> `;
      
      const isNew = sinceTs && new Date(m.created_at) > new Date(sinceTs);
      
      const pingedMe = myPseudo && m.message.toLowerCase().includes('@'+myPseudo.toLowerCase());
      if (pingedMe && isNew) triggerChatPingAttention();
      return `<div class="chatMsg chan-${chatChannel}${isNew?' newMsg':''}${pingedMe?' pingedMe':''}">${del}` +
        `${badge}${pseudoHtml}<span class="chatText">${highlightMentions(escapeHtml(m.message))}</span>` +
        `<span class="chatTime">${fmtChatTimestamp(m.created_at)}</span></div>`;
    }).join('');
    return bar + rows;
  }).join('');
  el.querySelectorAll('.chatDaySep:not(.current)').forEach(bar => {
    bar.onclick = () => {
      const key = bar.dataset.day;
      if (chatExpandedDays.has(key)) chatExpandedDays.delete(key); else chatExpandedDays.add(key);
      renderChatMessages(msgs, sinceTs);
    };
  });
  el.scrollTop = el.scrollHeight;
  el.querySelectorAll('.chatDelBtn').forEach(btn => {
    btn.onclick = async () => {
      if (!sb) return;
      const { error } = await sb.rpc('delete_chat_message', { p_id: parseInt(btn.dataset.id,10) });
      
      if (error) { $a('chatNote').textContent = (LANG==='fr'?'Suppression échouée : ':'Delete failed: ') + error.message; return; }
      fetchChatMessages();
    };
  });
}
async function fetchChatMessages() {
  if (!sb || chatFolded) return;
  if (chatChannel === 'modéré') { fetchModeratedLog(); return; }
  const { data, error } = await sb.from('chat_messages').select('id, pseudo, message, role, created_at')
    .eq('channel', chatChannel).order('created_at', { ascending:false }).limit(50);
  if (error) return;
  const msgs = (data||[]).slice().reverse();
  const prevLastRead = chatLastRead[chatChannel]; 
  renderChatMessages(msgs, prevLastRead);
  if (msgs.length) chatLastRead[chatChannel] = msgs[msgs.length-1].created_at;
  if (chatUnread[chatChannel]) { chatUnread[chatChannel] = false; renderChatTabs(); }
}

async function pollChatUnread() {
  if (!sb || !currentUser || isGuest()) return;
  for (const c of chatVisibleChannels()) {
    if (c.id === 'modéré') continue; 
    if (c.id === chatChannel && !chatFolded) continue; 
    try {
      const { data } = await sb.from('chat_messages').select('message, created_at')
        .eq('channel', c.id).order('created_at', { ascending:false }).limit(1);
      const row = data && data[0];
      const last = row && row.created_at;
      if (!last) continue;
      if (!chatLastRead[c.id]) { chatLastRead[c.id] = last; continue; } 
      if (new Date(last) > new Date(chatLastRead[c.id])) {
        chatUnread[c.id] = true;
        
        if (myPseudo && row.message && row.message.toLowerCase().includes('@'+myPseudo.toLowerCase())
            && new Date(last) > new Date(chatLastPingedAt[c.id] || 0)) {
          chatLastPingedAt[c.id] = last;
          triggerChatPingAttention();
        }
      }
    } catch (e) {}
  }
  renderChatTabs();
}

async function fetchModeratedLog() {
  const el = $a('chatMessages'); if (!el) return;
  const { data, error } = await sb.from('chat_deleted').select('id, channel, author_id, author_pseudo, message, deleted_at')
    .order('deleted_at', { ascending:false }).limit(50);
  if (error) { el.innerHTML = `<div class="chatEmpty">${LANG==='fr'?'Accès refusé ou schéma non exécuté':'Access denied or schema not run'}</div>`; return; }
  if (!data || !data.length) { el.innerHTML = `<div class="chatEmpty">${LANG==='fr'?'Aucun message supprimé':'No deleted messages'}</div>`; return; }
  el.innerHTML = data.map(m =>
    `<div class="chatMsg chan-annonce modMsg">` +
    `<div class="modTop"><span><span class="chatPseudo">${escapeHtml(m.author_pseudo||'?')}</span> <span class="modChan">[${escapeHtml(m.channel||'')}]</span></span>` +
    `<button class="modRestoreBtn" data-id="${m.id}" title="${LANG==='fr'?'Renvoyer ce message dans son canal':'Repost this message to its channel'}">${LANG==='fr'?'↩ Renvoyer':'↩ Restore'}</button></div>` +
    `<code class="modUuidLine">${m.author_id||''}</code>` +
    `<div class="chatText">${escapeHtml(m.message||'')}</div>` +
    `<div class="modDeletedAt">${LANG==='fr'?'Supprimé le':'Deleted on'} ${fmtChatTimestamp(m.deleted_at)}</div></div>`).join('');
  el.scrollTop = 0;
  el.querySelectorAll('.modRestoreBtn').forEach(btn => {
    btn.onclick = async () => {
      if (!sb) return;
      btn.disabled = true;
      const { error } = await sb.rpc('restore_chat_message', { p_deleted_id: parseInt(btn.dataset.id,10) });
      if (error) { $a('chatNote').textContent = (LANG==='fr'?'Renvoi échoué : ':'Restore failed: ') + error.message; btn.disabled = false; return; }
      fetchModeratedLog();
    };
  });
}
async function sendChatMessage() {
  const input = $a('chatInput');
  const val = input.value.trim();
  if (!val || !sb) return;
  input.value = '';
  
  const { error } = await sb.rpc('post_chat_message', { p_channel: chatChannel, p_message: val, p_pseudo: myPseudo || null });
  if (error) { $a('chatNote').textContent = error.message; return; }
  fetchChatMessages();
}
$a('chatSendBtn').onclick = sendChatMessage;

let onlinePlayersCache = [];
async function refreshOnlinePlayersCache() {
  if (!sb || !currentUser || isGuest()) return;
  try {
    const { data } = await sb.rpc('get_online_players');
    onlinePlayersCache = (data||[]).map(r => r.pseudo).filter(Boolean);
  } catch(e) {}
}
setInterval(refreshOnlinePlayersCache, 20000);
refreshOnlinePlayersCache();

let chatMentionActive = false, chatMentionStart = -1;
function updateChatMentionDropdown() {
  const input = $a('chatInput'), list = $a('chatMentionList');
  const val = input.value, pos = input.selectionStart;
  const before = val.slice(0, pos);
  const at = before.lastIndexOf('@');
  
  if (at === -1 || (at > 0 && !/\s/.test(before[at-1])) || /\s/.test(before.slice(at+1))) {
    list.classList.remove('show'); chatMentionActive = false; return;
  }
  const partial = before.slice(at+1).toLowerCase();
  const matches = onlinePlayersCache
    .filter(p => p.toLowerCase() !== (myPseudo||'').toLowerCase() && p.toLowerCase().includes(partial))
    .slice(0, 8);
  if (!matches.length) { list.classList.remove('show'); chatMentionActive = false; return; }
  chatMentionActive = true; chatMentionStart = at;
  list.innerHTML = matches.map((p,i) => `<div class="chatMentionItem${i===0?' active':''}" data-p="${escapeHtml(p)}">${escapeHtml(p)}</div>`).join('');
  list.classList.add('show');
  list.querySelectorAll('.chatMentionItem').forEach(el => { el.onclick = () => applyChatMention(el.dataset.p); });
}
function applyChatMention(pseudo) {
  const input = $a('chatInput');
  const val = input.value, pos = input.selectionStart;
  const before = val.slice(0, chatMentionStart), after = val.slice(pos);
  const inserted = '@' + pseudo + ' ';
  input.value = before + inserted + after;
  const newPos = (before + inserted).length;
  input.focus();
  input.setSelectionRange(newPos, newPos);
  $a('chatMentionList').classList.remove('show');
  chatMentionActive = false;
}

function moveChatMentionActive(delta) {
  const items = Array.from($a('chatMentionList').querySelectorAll('.chatMentionItem'));
  if (!items.length) return;
  let idx = items.findIndex(el => el.classList.contains('active'));
  items[idx]?.classList.remove('active');
  idx = (idx + delta + items.length) % items.length;
  items[idx].classList.add('active');
  items[idx].scrollIntoView({ block:'nearest' });
}
$a('chatInput').addEventListener('input', updateChatMentionDropdown);
$a('chatInput').addEventListener('keydown', e => {
  if (chatMentionActive && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault();
    moveChatMentionActive(e.key === 'ArrowDown' ? 1 : -1);
    return;
  }
  if (chatMentionActive && (e.key === 'Enter' || e.key === 'Tab')) {
    e.preventDefault();
    const active = $a('chatMentionList').querySelector('.chatMentionItem.active') || $a('chatMentionList').querySelector('.chatMentionItem');
    if (active) applyChatMention(active.dataset.p);
    return;
  }
  if (chatMentionActive && e.key === 'Escape') { $a('chatMentionList').classList.remove('show'); chatMentionActive = false; return; }
  if (e.key === 'Enter') sendChatMessage();
});

function highlightMentions(escapedText) {
  
  const placeholders = [];
  let result = escapedText;
  const multiWord = onlinePlayersCache.filter(n => /\s/.test(n)).sort((a,b) => b.length - a.length);
  for (const name of multiWord) {
    const esc = escapeHtml(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!esc) continue;
    result = result.replace(new RegExp('@' + esc + '(?!\\S)', 'gi'), m => {
      placeholders.push(`<span class="chatMention">${m}</span>`);
      return ` \x00${placeholders.length-1}\x00 `;
    });
  }
  
  result = result.replace(/@(\S+)/g, (m, word) => `<span class="chatMention">@${word}</span>`);
  
  result = result.replace(/ ?\x00(\d+)\x00 ?/g, (m, i) => placeholders[+i]);
  return result;
}

function triggerChatPingAttention() {
  const w = $a('chatWidget'); if (!w) return;
  w.classList.remove('pinged'); void w.offsetWidth; 
  w.classList.add('pinged');
  if (navigator.vibrate) { try { navigator.vibrate([120,60,120]); } catch(e) {} }
}
renderChatTabs();
updateChatInputVisibility();

$a('chatBody').style.display = chatFolded ? 'none' : '';
$a('chatFoldBtn').textContent = chatFolded ? '▸' : '▾';
setInterval(fetchChatMessages, 5000);
setInterval(pollChatUnread, 5000);
pollChatUnread();

// ==== src/market/market.js ====
function marketRequireAuth() {
  if (!sb || !currentUser) { alert('Connecte-toi pour accéder au marché.'); return false; }
  if (isGuest()) {
    alert(LANG==='fr'
      ? 'Le Marché et le Classement sont réservés aux comptes vérifiés (protection anti-triche). Clique sur "🔗 Lier un compte" pour en créer un — ta progression actuelle sera conservée.'
      : 'The Market and Leaderboard are restricted to verified accounts (anti-cheat protection). Click "🔗 Link account" to create one — your current progress will be kept.');
    return false;
  }
  return true;
}

$a('btnMarket').onclick = async () => {
  if (!marketRequireAuth()) return;
  if (!(typeof isAdmin === 'function' && isAdmin())) {
    try {
      const { data } = await sb.rpc('get_market_open');
      if (data === false) {
        alert(LANG==='fr'
          ? '🏛️ Le Marché est actuellement fermé pour maintenance. Réessaie plus tard.'
          : '🏛️ The Market is currently closed for maintenance. Try again later.');
        return;
      }
    } catch(e) {}
  }
  $a('marketOverlay').classList.add('open');
  refreshCommonMarket();
};
$a('closeMarket').onclick = () => $a('marketOverlay').classList.remove('open');
let marketMouseDownOnBackdrop = false;
$a('marketOverlay').addEventListener('mousedown', e => { marketMouseDownOnBackdrop = (e.target.id === 'marketOverlay'); });
$a('marketOverlay').addEventListener('click', e => { if (e.target.id === 'marketOverlay' && marketMouseDownOnBackdrop) $a('marketOverlay').classList.remove('open'); });

const MARKET_MATERIALS = [
  { name:'Pierre de Novice',   icon:ICO_MAT_NOVICE,     color:'#b8b8b8' },
  { name:'Pierre du Temps',    icon:ICO_MAT_TEMPS,      color:'#cfd8dc' },
  { name:'Pierre Noire',       icon:ICO_MAT_NOIRE,      color:'#7aa35e' },
  { name:'Pierre concentrée',  icon:ICO_MAT_CONCENTREE, color:'#6ea3c9' },
  { name:'Pierre de Caphras',  icon:ICO_MAT_CAPHRAS,    color:'#c9a55a' },
];
async function refreshCommonMarket() {
  wireCmSubTabs();
  refreshCmBrowse();
  refreshMyMarketOrders();
  initMarketMaterials();
}

const CM_TAB_PANES = { browse:'cmPaneBrowse', materials:'cmPaneMaterials', orders:'cmPaneOrders' };
function wireCmSubTabs() {
  document.querySelectorAll('.cmSubTab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.cmSubTab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.entries(CM_TAB_PANES).forEach(([tab, paneId]) => { $a(paneId).style.display = (tab === btn.dataset.cmtab) ? '' : 'none'; });
    };
  });
}

let mktSelectedIdx = 0, mktSide = 'buy';

const MARKET_SELL_TAX_RATE = 0.35;
function mktKey(m) { return 'material:' + m.name; }
function initMarketMaterials() {
  const pills = $a('mktItemPills'); if (!pills) return;
  pills.innerHTML = MARKET_MATERIALS.map((m,i) => `<button class="mktPill" data-i="${i}">${m.icon} ${tr(m.name)}</button>`).join('');
  pills.querySelectorAll('.mktPill').forEach(btn => {
    btn.onclick = () => { mktSelectedIdx = Number(btn.dataset.i); refreshMarketMaterials(); };
  });
  $a('mktSideBuy').onclick = () => { mktSide = 'buy'; updateMktForm(); };
  $a('mktSideSell').onclick = () => { mktSide = 'sell'; updateMktForm(); };
  $a('mktPlaceBtn').onclick = mktPlaceOrder;
  
  $a('mktPriceInput').addEventListener('input', updateMktTaxHint);
  $a('mktQtyInput').addEventListener('input', updateMktTaxHint);
  refreshMarketMaterials();
}

function updateMktTaxHint() {
  const hint = $a('mktSellTaxHint'); if (!hint) return;
  if (mktSide !== 'sell') { hint.style.display = 'none'; return; }
  const price = Number($a('mktPriceInput').value) || 0;
  const qty = parseInt($a('mktQtyInput').value, 10) || 0;
  hint.style.display = '';
  const net = Math.floor(price * qty * (1 - MARKET_SELL_TAX_RATE));
  hint.textContent = LANG==='fr'
    ? `Tu recevras ~${fmt(net)} silver après taxe de vente (${Math.round(MARKET_SELL_TAX_RATE*100)}%)`
    : `You'll receive ~${fmt(net)} silver after sale tax (${Math.round(MARKET_SELL_TAX_RATE*100)}%)`;
}

function updateMktPills() {
  const pills = $a('mktItemPills'); if (!pills) return;
  pills.querySelectorAll('.mktPill').forEach((btn,i) => {
    const active = i === mktSelectedIdx;
    btn.classList.toggle('active', active);
    if (active) {
      const color = MARKET_MATERIALS[i].color;
      btn.style.background = color; btn.style.borderColor = color; btn.style.color = '#0d0f1a';
    } else {
      btn.style.background = ''; btn.style.borderColor = ''; btn.style.color = '';
    }
  });
}
async function refreshMarketMaterials() {
  updateMktPills();
  const m = MARKET_MATERIALS[mktSelectedIdx];
  const key = mktKey(m);
  const [{ data: book }, { data: trades }] = await Promise.all([
    sb.rpc('market_order_book', { p_item_key: key }),
    sb.from('market_trades').select('price, qty, created_at').eq('item_key', key).order('created_at', { ascending: true }).limit(20),
  ]);
  const sells = (book || []).filter(o => o.side === 'sell').sort((a,b) => a.price - b.price);
  const buys = (book || []).filter(o => o.side === 'buy').sort((a,b) => b.price - a.price);
  const bestSell = sells[0], bestBuy = buys[0];
  const spread = (bestSell && bestBuy) ? (bestSell.price - bestBuy.price) : null;

  const recentTrades = (trades || []).slice(-10);
  let up = 0, down = 0;
  for (let i = 1; i < recentTrades.length; i++) {
    if (recentTrades[i].price > recentTrades[i-1].price) up++;
    else if (recentTrades[i].price < recentTrades[i-1].price) down++;
  }
  const pressure = recentTrades.length < 2 ? { icon:'➡️', label: LANG==='fr'?'NEUTRE':'NEUTRAL', cls:'' }
    : up > down ? { icon:'🔺', label: LANG==='fr'?'HAUSSE':'RISING', cls:'up' }
    : down > up ? { icon:'🔻', label: LANG==='fr'?'BAISSE':'FALLING', cls:'down' }
    : { icon:'➡️', label: LANG==='fr'?'NEUTRE':'NEUTRAL', cls:'' };

  $a('mktMetaRow').innerHTML = `
    <div class="mktMetaCard"><div class="mktMetaLbl">${LANG==='fr'?'Meilleure vente':'Best sell'}</div><div class="mktMetaVal sell">${bestSell?fmt(bestSell.price):'—'}</div></div>
    <div class="mktMetaCard"><div class="mktMetaLbl">${LANG==='fr'?'Spread':'Spread'}</div><div class="mktMetaVal">${spread!=null?fmt(spread):'—'}</div></div>
    <div class="mktMetaCard"><div class="mktMetaLbl">${LANG==='fr'?'Meilleur achat':'Best buy'}</div><div class="mktMetaVal buy">${bestBuy?fmt(bestBuy.price):'—'}</div></div>
    <div class="mktMetaCard"><div class="mktMetaLbl">${LANG==='fr'?'Pression marché':'Market pressure'}</div><div class="mktMetaVal ${pressure.cls}">${pressure.icon} ${pressure.label}</div></div>`;

  $a('mktSellCol').innerHTML = `<div class="mktColHead sell"><span>${LANG==='fr'?'Ordres de vente':'Sell orders'}</span><span>${sells.length}</span></div>` +
    `<div class="mktRowsWrap">${mktOrderRowsHtml(sells, 'sell')}</div>`;
  $a('mktBuyCol').innerHTML = `<div class="mktColHead buy"><span>${LANG==='fr'?'Ordres d\'achat':'Buy orders'}</span><span>${buys.length}</span></div>` +
    `<div class="mktRowsWrap">${mktOrderRowsHtml(buys, 'buy')}</div>`;

  const histRows = (trades || []).slice().reverse().map(t => `
    <div class="mktHistRow">
      <span>${tr(m.name)}</span><span>${fmt(t.price)}</span><span>×${fmt(t.qty)}</span>
      <span class="mktHistTime">${new Date(t.created_at).toLocaleTimeString(LANG==='fr'?'fr-FR':'en-US')}</span>
    </div>`).join('');
  $a('mktHistRows').innerHTML = histRows || `<div class="mEmpty">${LANG==='fr'?'Aucune transaction':'No transactions'}</div>`;

  drawMktCandles(trades || []);
  updateMktForm();
}
function mktOrderRowsHtml(orders, side) {
  if (!orders.length) return `<div class="mEmpty">${LANG==='fr'?'Aucun ordre':'No orders'}</div>`;
  const maxQty = Math.max(...orders.map(o => o.qty));
  return orders.map((o,i) => `
    <div class="mktOrderRow ${side}${i===0?' best':''}">
      <div class="mktVol" style="width:${Math.round(o.qty/maxQty*100)}%"></div>
      <span class="mktPrice">${fmt(o.price)}</span><span class="mktQty">${o.qty}</span><span class="mktTotal">${fmt(o.price*o.qty)}</span>
    </div>`).join('');
}
function updateMktForm() {
  const m = MARKET_MATERIALS[mktSelectedIdx];
  const owned = INV.filter(s => s && s.kind === 'material' && s.name === m.name).reduce((n,s) => n + s.qty, 0);
  $a('mktFormTitle').textContent = (LANG==='fr'?'Placer un ordre — ':'Place an order — ') + tr(m.name) + ' · ' + (LANG==='fr'?'possédé':'owned') + ' : ' + fmt(owned);
  $a('mktSideBuy').classList.toggle('active', mktSide==='buy');
  $a('mktSideSell').classList.toggle('active', mktSide==='sell');
  const btn = $a('mktPlaceBtn');
  btn.className = 'mktPlaceBtn ' + mktSide;
  btn.textContent = mktSide === 'buy' ? (LANG==='fr'?"Placer l'ordre d'achat":'Place buy order') : (LANG==='fr'?"Placer l'ordre de vente":'Place sell order');
  updateMktTaxHint();
  $a('mktFormMsg').textContent = '';
}
async function mktPlaceOrder() {
  const m = MARKET_MATERIALS[mktSelectedIdx];
  const price = Number($a('mktPriceInput').value), qty = parseInt($a('mktQtyInput').value, 10) || 1;
  const msg = $a('mktFormMsg');
  if (!price || price <= 0) { msg.textContent = LANG==='fr'?'Prix invalide.':'Invalid price.'; return; }
  let invIndex = null;
  if (mktSide === 'sell') {
    invIndex = INV.findIndex(s => s && s.kind === 'material' && s.name === m.name);
    if (invIndex === -1) { msg.textContent = LANG==='fr'?'Tu n\'en as pas.':'You don\'t have any.'; return; }
  }
  const { error } = await sb.rpc('market_place_order', {
    p_side: mktSide, p_item_key: mktKey(m), p_item_name: m.name, p_item_kind: 'material',
    p_price: price, p_qty: qty, p_inv_index: invIndex,
  });
  if (error) { msg.textContent = (LANG==='fr'?'Échec : ':'Failed: ') + error.message; return; }
  msg.textContent = '';
  $a('mktPriceInput').value = ''; $a('mktQtyInput').value = '1';
  await loadCloudSave();
  refreshMarketMaterials();
}

function drawMktCandles(trades) {
  const canvas = $a('mktCandleCv'); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.clientWidth * 2;
  const H = canvas.height = 220 * 2;
  ctx.clearRect(0,0,W,H);
  if (trades.length < 2) {
    ctx.fillStyle = '#5a5f74'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(LANG==='fr'?'Pas assez de transactions':'Not enough transactions', W/2, H/2);
    return;
  }
  const candles = [];
  for (let i = 1; i < trades.length; i++) {
    const open = Number(trades[i-1].price), close = Number(trades[i].price);
    candles.push({ open, close, high: Math.max(open,close), low: Math.min(open,close) });
  }
  const padL = 70, padR = 16, padT = 16, padB = 16;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const allPrices = candles.flatMap(c => [c.high, c.low]);
  let pMin = Math.min(...allPrices), pMax = Math.max(...allPrices);
  if (pMin === pMax) { pMin *= 0.98; pMax *= 1.02; }
  const pad = (pMax-pMin)*0.08; pMin -= pad; pMax += pad;
  const y = p => padT + plotH - ((p-pMin)/(pMax-pMin))*plotH;
  const cw = plotW/candles.length;
  ctx.strokeStyle = '#2c2a33'; ctx.lineWidth = 1; ctx.font = '18px sans-serif'; ctx.fillStyle = '#9a917e'; ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const py = padT + plotH*i/4;
    ctx.beginPath(); ctx.moveTo(padL,py); ctx.lineTo(W-padR,py); ctx.stroke();
    ctx.fillText(fmt(pMax - (pMax-pMin)*i/4), padL-8, py+6);
  }
  candles.forEach((c,i) => {
    const cx = padL + cw*i + cw/2;
    const up = c.close >= c.open;
    ctx.strokeStyle = ctx.fillStyle = up ? '#7aa35e' : '#c05545';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, y(c.high)); ctx.lineTo(cx, y(c.low)); ctx.stroke();
    const bodyTop = y(Math.max(c.open,c.close)), bodyBot = y(Math.min(c.open,c.close));
    const bw = Math.max(4, cw*0.55);
    ctx.fillRect(cx-bw/2, bodyTop, bw, Math.max(2, bodyBot-bodyTop));
  });
}

const CM_CATEGORIES = [
  { id:'all',       label:{fr:'★ Tout',en:'★ All'},                          kind:null,      slots:null },
  { id:'weapon',    label:{fr:'⚔️ Arme principale',en:'⚔️ Main weapon'},      kind:'gear',    slots:['weapon'] },
  { id:'secondary', label:{fr:'🗡️ Arme secondaire',en:'🗡️ Secondary weapon'}, kind:'gear',    slots:['secondary'] },
  { id:'awakening', label:{fr:'✨ Arme d\'éveil',en:'✨ Awakening weapon'},     kind:'gear',    slots:['awakening'] },
  { id:'armor',     label:{fr:'🛡️ Armure',en:'🛡️ Armor'},                    kind:'gear',    slots:['helmet','armor','gloves','boots'] },
  { id:'accessory', label:{fr:'💍 Accessoires',en:'💍 Accessories'},          kind:'jackpot', slots:null },
  { id:'artifact',  label:{fr:'🔮 Artéfact / Pierre',en:'🔮 Artifact / Stone'}, kind:'gear',   slots:['artifact1','artifact2','eqStone'] },
  { id:'material',  label:{fr:'◈ Matériaux',en:'◈ Materials'},               kind:'material', slots:null },
];
let cmActiveCat = 'all', cmListings = [], cmSelectedId = null, cmDrilldownName = null;
function renderCmCategoryTree() {
  const el = $a('cmCategoryTree'); if (!el) return;
  el.innerHTML = CM_CATEGORIES.map(c => `<button class="cmCatBtn${c.id===cmActiveCat?' active':''}" data-cat="${c.id}">${c.label[LANG]}</button>`).join('');
  el.querySelectorAll('.cmCatBtn').forEach(btn => {
    btn.onclick = () => { cmActiveCat = btn.dataset.cat; cmDrilldownName = null; cmSelectedId = null; refreshCmBrowse(); };
  });
}
function updateCmWallet() { const el = $a('cmWalletVal'); if (el) el.textContent = fmt(Math.round(S.silver)) + ' 🪙'; }
async function refreshCmBrowse() {
  renderCmCategoryTree();
  updateCmWallet();
  const list = $a('cmListingsList'); if (!list) return;
  list.innerHTML = '<div class="mEmpty">Chargement...</div>';
  const cat = CM_CATEGORIES.find(c => c.id === cmActiveCat) || CM_CATEGORIES[0];
  const { data, error } = await sb.rpc('market_listings', { p_kind: cat.kind });
  let rows = data || [];
  if (cat.slots) rows = rows.filter(l => l.item_snapshot && cat.slots.includes(l.item_snapshot.slot));
  cmListings = rows;
  if (error) { list.innerHTML = `<div class="mEmpty">${LANG==='fr'?'Erreur de chargement':'Loading error'}</div>`; return; }
  renderCmListingsList();
}
function cmListingIcon(l) {
  if (l.item_kind === 'material') { const m = MARKET_MATERIALS.find(x => x.name === l.item_name); return m ? m.icon : '◈'; }
  return l.item_snapshot ? l.item_snapshot.icon : '📦';
}
function cmListingColor(l) {
  if (l.item_kind === 'material') { const m = MARKET_MATERIALS.find(x => x.name === l.item_name); return m ? m.color : '#8fb0c9'; }
  return l.item_snapshot ? l.item_snapshot.color : '#c9a55a';
}
function cmTimeAgo(iso) {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime())/1000);
  if (sec < 3600) return Math.round(sec/60) + 'm';
  if (sec < 86400) return Math.round(sec/3600) + 'h';
  return Math.round(sec/86400) + 'j';
}

function cmApplySearchSort(items, priceOf, timeOf) {
  const search = ($a('cmSearch').value || '').toLowerCase().trim();
  const sort = $a('cmSort').value;
  let rows = items.filter(x => !search || tr(x.name || x.item_name).toLowerCase().includes(search));
  if (sort === 'price_asc') rows.sort((a,b) => priceOf(a) - priceOf(b));
  else if (sort === 'price_desc') rows.sort((a,b) => priceOf(b) - priceOf(a));
  else rows.sort((a,b) => new Date(timeOf(b)) - new Date(timeOf(a)));
  return rows;
}
function renderCmListingsList() {
  const list = $a('cmListingsList'); if (!list) return;
  if (cmDrilldownName) { renderCmDrilldown(); return; }
  
  const groups = new Map();
  for (const l of cmListings) {
    if (!groups.has(l.item_name)) groups.set(l.item_name, { name: l.item_name, kind: l.item_kind, items: [] });
    groups.get(l.item_name).items.push(l);
  }
  let rows = [...groups.values()].map(g => {
    const best = g.items.reduce((a,b) => a.price < b.price ? a : b);
    const stock = g.items.reduce((n,x) => n + (x.item_kind === 'material' ? x.qty : 1), 0);
    const enhLvs = new Set(g.items.map(x => (x.item_snapshot && x.item_snapshot.enhLv) || 0));
    return { ...g, best, stock, drilldown: enhLvs.size > 1, latest: g.items.reduce((a,b) => new Date(a.created_at)>new Date(b.created_at)?a:b).created_at };
  });
  rows = cmApplySearchSort(rows, r => r.best.price, r => r.latest);
  if (!rows.length) { list.innerHTML = `<div class="mEmpty">${LANG==='fr'?'Aucune vente en cours':'No listings right now'}</div>`; return; }
  list.innerHTML = rows.map(g => {
    const color = cmListingColor(g.best);
    return `<div class="cmListCard" data-name="${escapeHtml(g.name)}">
      <div class="cmListIcon" style="color:${color}">${cmListingIcon(g.best)}</div>
      <div class="cmListInfo">
        <div class="cmListName" style="color:${color}">${tr(g.name)}</div>
        <div class="cmListSub">${LANG==='fr'?'En stock':'In stock'} : ${fmt(g.stock)}${g.drilldown?` · ${g.items.length} ${LANG==='fr'?'niveaux':'levels'}`:''}</div>
      </div>
      <div class="cmListPrice"><div class="price">${LANG==='fr'?'dès':'from'} ${fmt(g.best.price)} 🪙</div></div>
    </div>`;
  }).join('');
  list.querySelectorAll('.cmListCard').forEach(card => {
    const g = rows.find(r => r.name === card.dataset.name);
    card.onclick = () => {
      if (g.drilldown) { cmDrilldownName = g.name; renderCmListingsList(); }
      else { cmSelectedId = g.best.id; renderCmDetailPanel(); }
    };
  });
}

function renderCmDrilldown() {
  const list = $a('cmListingsList'); if (!list) return;
  const items = cmListings.filter(l => l.item_name === cmDrilldownName);
  const byLv = new Map();
  for (const l of items) {
    const lv = (l.item_snapshot && l.item_snapshot.enhLv) || 0;
    if (!byLv.has(lv)) byLv.set(lv, []);
    byLv.get(lv).push(l);
  }
  let rows = [...byLv.entries()].map(([lv, arr]) => ({
    lv, best: arr.reduce((a,b) => a.price < b.price ? a : b), stock: arr.length,
    latest: arr.reduce((a,b) => new Date(a.created_at)>new Date(b.created_at)?a:b).created_at,
  }));
  rows.sort((a,b) => a.lv - b.lv);
  rows = cmApplySearchSort(rows.map(r => ({...r, name:cmDrilldownName})), r => r.best.price, r => r.latest);
  const backBtn = `<button class="cmBackBtn" id="cmBackBtn">← ${LANG==='fr'?'Retour':'Back'}</button>`;
  list.innerHTML = backBtn + rows.map(r => {
    const color = cmListingColor(r.best);
    return `<div class="cmListCard" data-lv="${r.lv}">
      <div class="cmListIcon" style="color:${color}">${cmListingIcon(r.best)}</div>
      <div class="cmListInfo">
        <div class="cmListName" style="color:${color}">${ENH_NAMES[r.lv]} ${tr(cmDrilldownName)}</div>
        <div class="cmListSub">${LANG==='fr'?'En stock':'In stock'} : ${fmt(r.stock)}</div>
      </div>
      <div class="cmListPrice"><div class="price">${LANG==='fr'?'dès':'from'} ${fmt(r.best.price)} 🪙</div></div>
    </div>`;
  }).join('');
  $a('cmBackBtn').onclick = () => { cmDrilldownName = null; renderCmListingsList(); };
  list.querySelectorAll('.cmListCard').forEach(card => {
    const r = rows.find(x => x.lv === Number(card.dataset.lv));
    card.onclick = () => { cmSelectedId = r.best.id; renderCmDetailPanel(); };
  });
}

function renderCmDetailPanel() {
  const panel = $a('cmDetailPanel'); if (!panel) return;
  const l = cmListings.find(x => x.id === cmSelectedId);
  if (!l) { panel.innerHTML = `<div class="mEmpty" data-i18n="cmSelectItemHint">${LANG==='fr'?'Clique un objet pour voir le détail':'Click an item to see the detail'}</div>`; return; }
  const color = cmListingColor(l);
  let statsHtml = '', compareHtml = '';
  if (l.item_kind === 'gear' || l.item_kind === 'jackpot') {
    const snap = l.item_snapshot || {};
    const eff = effectiveApDp(snap);
    const rows = [];
    if (eff.ap) rows.push(['PA', '+'+eff.ap]);
    if (eff.dp) rows.push(['PD', '+'+eff.dp]);
    if (eff.hp) rows.push(['PV', '+'+eff.hp]);
    if (snap.enhLv) rows.push([LANG==='fr'?'Niveau':'Level', ENH_NAMES[snap.enhLv]]);
    statsHtml = `<div class="cmDetailStats">${rows.map(([k,v]) => `<div class="srow"><span>${k}</span><b>${v}</b></div>`).join('')}</div>`;
    
    const slotId = l.item_kind === 'jackpot' ? accSlotFor(snap) : snap.slot;
    const accSlot = l.item_kind === 'jackpot' ? accSlotFor(snap) : null;
    let equipped = slotId ? EQUIP[slotId] : null;
    if (accSlot === 'ring') equipped = itemScore(EQUIP.ring1) <= itemScore(EQUIP.ring2) ? EQUIP.ring1 : EQUIP.ring2;
    if (accSlot === 'earring') equipped = itemScore(EQUIP.earring1) <= itemScore(EQUIP.earring2) ? EQUIP.earring1 : EQUIP.earring2;
    if (equipped) {
      const effEq = effectiveApDp(equipped);
      const cmpRows = [['PA', effEq.ap||0, eff.ap||0], ['PD', effEq.dp||0, eff.dp||0], ['PV', effEq.hp||0, eff.hp||0]]
        .filter(([,a,b]) => a || b);
      compareHtml = `<div class="cmDetailSub">${LANG==='fr'?'Face à':'Vs'} <b style="color:${equipped.color||'#c9a55a'}">${tr(equipped.name)}</b></div>
        <table class="cmCompareTable"><thead><tr><th></th><th>${LANG==='fr'?'Équipé':'Equipped'}</th><th>${LANG==='fr'?'Celui-ci':'This one'}</th><th>Δ</th></tr></thead>
        <tbody>${cmpRows.map(([k,a,b]) => {
          const delta = b - a; const cls = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
          return `<tr><td>${k}</td><td>${a}</td><td>${b}</td><td class="cmDelta ${cls}">${delta>0?'+':''}${delta}</td></tr>`;
        }).join('')}</tbody></table>`;
    }
  } else {
    statsHtml = `<div class="cmDetailStats"><div class="srow"><span>${LANG==='fr'?'Quantité disponible':'Available qty'}</span><b>${fmt(l.qty)}</b></div></div>`;
  }
  panel.innerHTML = `
    <div class="cmDetailIcon" style="border-color:${color};color:${color}">${cmListingIcon(l)}</div>
    <div class="cmDetailTitle" style="color:${color}">${tr(l.item_name)}</div>
    <div class="cmDetailSub">${LANG==='fr'?'Vendu par':'Sold by'} ${escapeHtml(l.pseudo||'?')} · ${cmTimeAgo(l.created_at)}</div>
    ${statsHtml}${compareHtml}
    <div class="cmDetailSub" style="margin-top:8px">${fmt(l.price)} 🪙${l.item_kind==='material'?(' × '+fmt(l.qty)):''}</div>
    <button class="btnBuyListing">${LANG==='fr'?'Acheter':'Buy'}</button>`;
  panel.querySelector('.btnBuyListing').onclick = () => buyCmListing(l);
}

async function buyCmListing(l) {
  const msg = $a('commonMsg');
  const { error } = await sb.rpc('market_place_order', {
    p_side: 'buy', p_item_key: l.item_key, p_item_name: l.item_name, p_item_kind: l.item_kind,
    p_price: l.price, p_qty: l.item_kind === 'material' ? l.qty : 1, p_inv_index: null,
  });
  if (error) { msg.textContent = (LANG==='fr'?'Échec : ':'Failed: ') + error.message; msg.className = 'fail'; return; }
  msg.textContent = LANG==='fr'?'Achat effectué ✓':'Purchase complete ✓'; msg.className = 'ok';
  await loadCloudSave();
  updateCmWallet();
  refreshCmBrowse();
  refreshMyMarketOrders();
}
$a('cmSearch').oninput = () => renderCmListingsList();
$a('cmSort').onchange = () => renderCmListingsList();

async function placeMarketOrder(side, key, name, kind, priceStr, qtyStr, invIndex) {
  const msg = $a('commonMsg');
  const price = Number(priceStr), qty = parseInt(qtyStr, 10) || 1;
  if (!price || price <= 0) { msg.textContent = LANG==='fr'?'Prix invalide.':'Invalid price.'; msg.className = 'fail'; return; }
  if (side === 'sell' && invIndex == null) {
    invIndex = INV.findIndex(s => s && s.kind === kind && s.name === name);
    if (invIndex === -1) { msg.textContent = LANG==='fr'?'Tu n\'en as pas.':'You don\'t have any.'; msg.className = 'fail'; return; }
  }
  const { error } = await sb.rpc('market_place_order', {
    p_side: side, p_item_key: key, p_item_name: name, p_item_kind: kind,
    p_price: price, p_qty: kind === 'material' ? qty : 1, p_inv_index: side==='sell' ? invIndex : null,
  });
  if (error) { msg.textContent = (LANG==='fr'?'Échec : ':'Failed: ') + error.message; msg.className = 'fail'; return; }
  msg.textContent = LANG==='fr'?'Ordre posé ✓ (exécuté immédiatement si un ordre opposé compatible existait)':'Order placed ✓ (filled immediately if a compatible opposite order existed)';
  msg.className = 'ok';
  await loadCloudSave();
  refreshCommonMarket();
}

async function refreshMyMarketOrders() {
  const box = $a('cmMyOrders'); if (!box) return;
  const { data, error } = await sb.rpc('market_my_orders');
  if (error || !data || !data.length) { box.innerHTML = `<div class="mEmpty">${LANG==='fr'?'Aucun ordre':'No orders'}</div>`; return; }
  box.innerHTML = data.map(o => `
    <div class="cmRow">
      <div class="cmInfo"><div class="mName">${o.side==='buy'?'🛒':'🏷️'} ${tr(o.item_name)}</div>
        <div class="cmOwned">${o.side==='buy'?(LANG==='fr'?'Achat':'Buy'):(LANG==='fr'?'Vente':'Sell')} · ${fmt(o.price)} 🪙 × ${fmt(o.qty)}/${fmt(o.qty_original)} · ${o.status==='open'?(LANG==='fr'?'ouvert':'open'):(LANG==='fr'?'terminé':'done')}</div></div>
      ${o.status==='open' ? `<button class="cmCancelOrder" data-id="${o.id}">${LANG==='fr'?'Annuler':'Cancel'}</button>` : ''}
    </div>`).join('');
  box.querySelectorAll('.cmCancelOrder').forEach(btn => {
    btn.onclick = async () => {
      const { error } = await sb.rpc('market_cancel_order', { p_order_id: Number(btn.dataset.id) });
      if (!error) { await loadCloudSave(); refreshCommonMarket(); }
    };
  });
}
